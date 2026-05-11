import { formatEther, type Address, type Hex } from "viem";
import { config } from "./config.js";
import {
  ADDRESSES,
  createClients,
  erc20Abi,
  quoterV2Abi,
  swapRouter02Abi,
  wethAbi,
} from "./chain.js";
import type { BundleWallet } from "./wallets.js";
import { logger } from "./logger.js";

function minOut(quoted: bigint, slippageBps: number): bigint {
  return (quoted * BigInt(10_000 - slippageBps)) / 10_000n;
}

async function quote(
  publicClient: ReturnType<typeof createClients>["publicClient"],
  account: Address,
  tokenOut: Address,
  fee: number,
  amountIn: bigint,
): Promise<bigint> {
  try {
    const result = await publicClient.simulateContract({
      address: ADDRESSES.quoterV2,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: ADDRESSES.weth,
          tokenOut,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        },
      ],
      account,
    });
    return result.result[0];
  } catch {
    return 0n;
  }
}

export async function fundWallets(
  masterKey: Hex,
  wallets: BundleWallet[],
): Promise<void> {
  const master = createClients(masterKey);
  const perWallet = config.buyAmountWei + config.gasReserveWei;

  logger.info(
    `Funding ${wallets.length} wallets with ${formatEther(perWallet)} ETH each`,
  );

  for (const w of wallets) {
    if (w.address.toLowerCase() === master.account.address.toLowerCase()) {
      logger.warn(`Skip funding deployer ${w.address}`);
      continue;
    }

    if (config.dryRun) {
      logger.info(`[DRY_RUN] would fund ${w.address}`);
      continue;
    }

    const hash = await master.walletClient.sendTransaction({
      account: master.account,
      chain: master.walletClient.chain,
      to: w.address,
      value: perWallet,
    });
    await master.publicClient.waitForTransactionReceipt({ hash });
    logger.info(`Funded ${w.address} tx=${hash}`);
  }
}

export async function buyWithWallet(
  wallet: BundleWallet,
  token: Address,
  poolFee: number,
  amountIn: bigint = config.buyAmountWei,
): Promise<Hex | "dry-run"> {
  const clients = createClients(wallet.privateKey);

  logger.info(
    `Buy ${formatEther(amountIn)} WETH -> ${token} from ${wallet.address}`,
  );

  if (config.dryRun) {
    logger.info("[DRY_RUN] skip wrap/approve/swap");
    return "dry-run";
  }

  const wrapHash = await clients.walletClient.writeContract({
    address: ADDRESSES.weth,
    abi: wethAbi,
    functionName: "deposit",
    value: amountIn,
    account: clients.account,
    chain: clients.walletClient.chain,
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: wrapHash });

  const allowance = await clients.publicClient.readContract({
    address: ADDRESSES.weth,
    abi: erc20Abi,
    functionName: "allowance",
    args: [clients.account.address, ADDRESSES.swapRouter02],
  });

  if (allowance < amountIn) {
    const approveHash = await clients.walletClient.writeContract({
      address: ADDRESSES.weth,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDRESSES.swapRouter02, amountIn],
      account: clients.account,
      chain: clients.walletClient.chain,
    });
    await clients.publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const quoted = await quote(
    clients.publicClient,
    clients.account.address,
    token,
    poolFee,
    amountIn,
  );
  const amountOutMinimum = quoted > 0n ? minOut(quoted, config.slippageBps) : 0n;

  const swapHash = await clients.walletClient.writeContract({
    address: ADDRESSES.swapRouter02,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: ADDRESSES.weth,
        tokenOut: token,
        fee: poolFee,
        recipient: clients.account.address,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
    account: clients.account,
    chain: clients.walletClient.chain,
  });

  await clients.publicClient.waitForTransactionReceipt({ hash: swapHash });
  logger.info(`Buy confirmed ${wallet.address} tx=${swapHash}`);
  return swapHash;
}

export async function bundleBuys(
  wallets: BundleWallet[],
  token: Address,
  poolFee: number,
): Promise<void> {
  logger.info(`Firing ${wallets.length} bundle buys (parallel submit)`);

  const results = await Promise.allSettled(
    wallets.map((w) => buyWithWallet(w, token, poolFee)),
  );

  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      logger.info(`Wallet[${i}] ok tx=${result.value}`);
    } else {
      logger.error(`Wallet[${i}] buy failed`, result.reason);
    }
  }
}
