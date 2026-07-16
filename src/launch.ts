import {
  decodeEventLog,
  formatEther,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { config, LAUNCH_FEE_WEI } from "./config.js";
import {
  ADDRESSES,
  launchFactoryAbi,
  type Clients,
} from "./chain.js";
import { logger } from "./logger.js";

export type LaunchResult = {
  token: Address;
  pool: Address;
  txHash: Hex | "dry-run";
  initialBuyAmount: bigint;
  poolFee: number;
};

function randomSalt(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return keccak256(bytes);
}

export async function launchToken(clients: Clients): Promise<LaunchResult> {
  const value = config.initialBuyWei + LAUNCH_FEE_WEI;
  const salt = randomSalt();
  const recipient = clients.account.address;

  const params = {
    name: config.tokenName,
    symbol: config.tokenSymbol,
    metadataURI: config.metadataURI,
    description: config.tokenDescription,
    socials: {
      twitter: config.socials.twitter,
      telegram: config.socials.telegram,
      website: config.socials.website,
      discord: config.socials.discord,
      farcaster: config.socials.farcaster,
    },
    recipient,
  } as const;

  logger.info(
    `Launching "${config.tokenName}" (${config.tokenSymbol}) value=${formatEther(value)} ETH (buy=${formatEther(config.initialBuyWei)} + fee=${formatEther(LAUNCH_FEE_WEI)})`,
  );
  logger.info(`salt=${salt}`);

  if (config.dryRun) {
    logger.info("[DRY_RUN] skip launchToken");
    return {
      token: "0x0000000000000000000000000000000000000000",
      pool: "0x0000000000000000000000000000000000000000",
      txHash: "dry-run",
      initialBuyAmount: config.initialBuyWei,
      poolFee: 10_000,
    };
  }

  const hash = await clients.walletClient.writeContract({
    address: ADDRESSES.launchFactory,
    abi: launchFactoryAbi,
    functionName: "launchToken",
    args: [params, config.dexId, config.launchConfigId, salt],
    value,
    account: clients.account,
    chain: clients.walletClient.chain,
  });

  logger.info(`Launch tx submitted: ${hash}`);
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Launch tx reverted: ${hash}`);
  }

  let token: Address | undefined;
  let pool: Address | undefined;
  let initialBuyAmount = config.initialBuyWei;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ADDRESSES.launchFactory.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: launchFactoryAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "TokenLaunched") {
        token = decoded.args.token;
        pool = decoded.args.pool;
        initialBuyAmount = decoded.args.initialBuyAmount;
      }
    } catch {
      // not our event
    }
  }

  if (!token || !pool) {
    throw new Error("TokenLaunched event not found in launch receipt");
  }

  const launched = await clients.publicClient.readContract({
    address: ADDRESSES.launchFactory,
    abi: launchFactoryAbi,
    functionName: "getLaunchedToken",
    args: [token],
  });

  const poolFee = Number(launched.poolFee || 10_000);
  logger.info(`Launched token=${token} pool=${pool} fee=${poolFee}`);

  return {
    token,
    pool,
    txHash: hash,
    initialBuyAmount,
    poolFee,
  };
}
