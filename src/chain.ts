import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";

export const NOXA_UI_URL = "https://fun.noxa.eth.limo/" as const;

export const ADDRESSES = {
  launchFactory: "0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB" as Address,
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address,
  swapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2" as Address,
  quoterV2: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7" as Address,
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11" as Address,
} as const;

export const robinhoodChain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
} as const satisfies Chain;

/** Recovered from live NOXA launch txs (selector 0x686399cb). */
export const launchFactoryAbi = [
  {
    type: "function",
    name: "launchToken",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "metadataURI", type: "string" },
          { name: "description", type: "string" },
          {
            name: "socials",
            type: "tuple",
            components: [
              { name: "twitter", type: "string" },
              { name: "telegram", type: "string" },
              { name: "website", type: "string" },
              { name: "discord", type: "string" },
              { name: "farcaster", type: "string" },
            ],
          },
          { name: "recipient", type: "address" },
        ],
      },
      { name: "dexId", type: "uint256" },
      { name: "launchConfigId", type: "uint256" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    type: "event",
    name: "TokenLaunched",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "deployer", type: "address", indexed: true },
      { name: "dexFactory", type: "address", indexed: true },
      { name: "pairToken", type: "address", indexed: false },
      { name: "pool", type: "address", indexed: false },
      { name: "dexId", type: "uint256", indexed: false },
      { name: "launchConfigId", type: "uint256", indexed: false },
      { name: "positionId", type: "uint256", indexed: false },
      { name: "restrictionsEndBlock", type: "uint256", indexed: false },
      { name: "initialBuyAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "getLaunchedToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "deployer", type: "address" },
          { name: "pairedToken", type: "address" },
          { name: "positionManager", type: "address" },
          { name: "positionId", type: "uint256" },
          { name: "dexId", type: "uint256" },
          { name: "launchConfigId", type: "uint256" },
          { name: "restrictionsEndBlock", type: "uint256" },
          { name: "supply", type: "uint256" },
          { name: "isToken0", type: "bool" },
          { name: "poolFee", type: "uint24" },
          { name: "exists", type: "bool" },
          { name: "initialBuyAmount", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const wethAbi = [
  ...erc20Abi,
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] },
] as const;

export const swapRouter02Abi = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const quoterV2Abi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export type Clients = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
};

export function createClients(privateKey: Hex): Clients {
  const account = privateKeyToAccount(privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({
    chain: robinhoodChain,
    transport,
  });
  const walletClient = createWalletClient({
    account,
    chain: robinhoodChain,
    transport,
  });
  return { publicClient, walletClient, account };
}
