import fs from "fs";
import path from "path";
import { type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";
import { logger } from "./logger.js";

export type BundleWallet = {
  privateKey: Hex;
  address: `0x${string}`;
};

export function resolveBundleWallets(): BundleWallet[] {
  if (config.bundlePrivateKeys.length > 0) {
    return config.bundlePrivateKeys.map((privateKey) => {
      const account = privateKeyToAccount(privateKey);
      return { privateKey, address: account.address };
    });
  }

  const wallets: BundleWallet[] = [];
  for (let i = 0; i < config.bundleWalletCount; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    wallets.push({ privateKey, address: account.address });
  }
  return wallets;
}

export function persistWallets(wallets: BundleWallet[], file = "generated-wallets.json"): void {
  const out = path.resolve(process.cwd(), file);
  fs.writeFileSync(
    out,
    JSON.stringify(
      wallets.map((w) => ({ address: w.address, privateKey: w.privateKey })),
      null,
      2,
    ),
  );
  logger.warn(`Wrote ${wallets.length} wallets to ${out} — keep this secret`);
}

export function printWallets(wallets: BundleWallet[]): void {
  logger.info(`Bundle wallets (${wallets.length}):`);
  for (const [i, w] of wallets.entries()) {
    console.log(`  [${i}] ${w.address}`);
    console.log(`       ${w.privateKey}`);
  }
}
