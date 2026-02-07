import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const ARB_RPC = process.env.ARB_RPC || 'https://sepolia-rollup.arbitrum.io/rpc';

// Validate and get ORACLE_KEY
let ORACLE_KEY: `0x${string}`;
if (!process.env.ORACLE_KEY || process.env.ORACLE_KEY === '0x...') {
  console.warn('⚠️  ORACLE_KEY not configured in .env file. Using dummy key for development.');
  console.warn('⚠️  Settlement features will not work without a valid private key.');
  // Use a valid dummy private key (DO NOT use in production!)
  ORACLE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
} else {
  ORACLE_KEY = process.env.ORACLE_KEY as `0x${string}`;
}

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(ARB_RPC),
});

export const walletClient = createWalletClient({
  chain: arbitrumSepolia,
  account: privateKeyToAccount(ORACLE_KEY),
  transport: http(ARB_RPC),
});
