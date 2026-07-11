import { formatEther } from "viem";
import { config, LAUNCH_FEE_WEI, requirePrivateKey } from "./config.js";
import { createClients, NOXA_UI_URL } from "./chain.js";
import { launchToken } from "./launch.js";
import { bundleBuys, fundWallets } from "./buy.js";
import {
  persistWallets,
  printWallets,
  resolveBundleWallets,
} from "./wallets.js";
import { logger } from "./logger.js";

function usage(): void {
  console.log(`NOXA Token Bundler

Usage:
  npm run wallets   Generate / print bundle wallets
  npm run launch    Launch token only (creator initial buy)
  npm run bundle    Fund wallets → launch → multi-wallet buys

UI: ${NOXA_UI_URL}
`);
}

async function cmdWallets(): Promise<void> {
  const wallets = resolveBundleWallets();
  printWallets(wallets);
  if (config.bundlePrivateKeys.length === 0) {
    persistWallets(wallets);
  }
}

async function cmdLaunch(): Promise<void> {
  const clients = createClients(requirePrivateKey());
  logger.info(`Deployer: ${clients.account.address}`);
  logger.info(`DRY_RUN=${config.dryRun}`);
  const result = await launchToken(clients);
  logger.info(
    `Done token=${result.token} pool=${result.pool} tx=${result.txHash}`,
  );
}

async function cmdBundle(): Promise<void> {
  const deployerKey = requirePrivateKey();
  const clients = createClients(deployerKey);
  const wallets = resolveBundleWallets();

  logger.info(`UI: ${NOXA_UI_URL}`);
  logger.info(`Deployer: ${clients.account.address}`);
  logger.info(`DRY_RUN=${config.dryRun}`);
  logger.info(`Token: ${config.tokenName} (${config.tokenSymbol})`);
  logger.info(
    `Creator buy: ${formatEther(config.initialBuyWei)} ETH (+ ${formatEther(LAUNCH_FEE_WEI)} fee)`,
  );
  logger.info(
    `Bundle: ${wallets.length} wallets x ${formatEther(config.buyAmountWei)} ETH`,
  );

  if (config.bundlePrivateKeys.length === 0) {
    printWallets(wallets);
    persistWallets(wallets);
  }

  await fundWallets(deployerKey, wallets);

  const launched = await launchToken(clients);

  if (config.dryRun) {
    logger.info("[DRY_RUN] skip bundle buys (no real token address)");
    return;
  }

  await bundleBuys(wallets, launched.token, launched.poolFee);
  logger.info(`Bundle complete. token=${launched.token} pool=${launched.pool}`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "bundle";

  switch (cmd) {
    case "wallets":
      await cmdWallets();
      break;
    case "launch":
      await cmdLaunch();
      break;
    case "bundle":
      await cmdBundle();
      break;
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      logger.error(`Unknown command: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  logger.error("Fatal", err);
  process.exit(1);
});
