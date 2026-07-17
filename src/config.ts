import "dotenv/config";
import { type Hex, isHex, parseEther } from "viem";

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

function num(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid number for ${name}`);
  return value;
}

function parseKey(value: string, label: string): Hex {
  if (!isHex(value) || value.length !== 66) {
    throw new Error(`${label} must be a 0x-prefixed 32-byte hex key`);
  }
  return value;
}

const bundleKeysRaw = optional("BUNDLE_PRIVATE_KEYS");
const bundlePrivateKeys = bundleKeysRaw
  ? bundleKeysRaw.split(",").map((k) => parseKey(k.trim(), "BUNDLE_PRIVATE_KEYS entry"))
  : [];

export const LAUNCH_FEE_WEI = parseEther("0.0005");

export const config = {
  privateKey: optional("PRIVATE_KEY")
    ? parseKey(optional("PRIVATE_KEY"), "PRIVATE_KEY")
    : undefined,
  bundlePrivateKeys,
  bundleWalletCount: Math.max(1, Math.floor(num("BUNDLE_WALLET_COUNT", 5))),
  rpcUrl: optional("RPC_URL", "https://rpc.mainnet.chain.robinhood.com"),
  dryRun: bool("DRY_RUN", true),
  tokenName: optional("TOKEN_NAME", "My Token"),
  tokenSymbol: optional("TOKEN_SYMBOL", "MTK"),
  tokenDescription: optional("TOKEN_DESCRIPTION", ""),
  metadataURI: optional("METADATA_URI", ""),
  socials: {
    twitter: optional("TWITTER", ""),
    telegram: optional("TELEGRAM", ""),
    website: optional("WEBSITE", ""),
    discord: optional("DISCORD", ""),
    farcaster: optional("FARCASTER", ""),
  },
  initialBuyWei: parseEther(optional("INITIAL_BUY_ETH", "0.05")),
  buyAmountWei: parseEther(optional("BUY_AMOUNT_ETH", "0.01")),
  gasReserveWei: parseEther(optional("GAS_RESERVE_ETH", "0.002")),
  dexId: BigInt(Math.floor(num("DEX_ID", 0))),
  launchConfigId: BigInt(Math.floor(num("LAUNCH_CONFIG_ID", 0))),
  slippageBps: Math.floor(num("SLIPPAGE_BPS", 1000)),
} as const;

export function requirePrivateKey(): Hex {
  if (!config.privateKey) {
    throw new Error("Missing required env: PRIVATE_KEY");
  }
  return config.privateKey;
}
 