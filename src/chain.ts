import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const ARB_RPC = process.env.ARB_RPC || 'https://sepolia-rollup.arbitrum.io/rpc';
const ORACLE_KEY = (process.env.ORACLE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001') as `0x${string}`;

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(ARB_RPC),
});

export const walletClient = createWalletClient({
  chain: arbitrumSepolia,
  account: privateKeyToAccount(ORACLE_KEY),
  transport: http(ARB_RPC),
});
