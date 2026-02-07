import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const ARB_RPC = process.env.ARB_RPC || 'https://sepolia-rollup.arbitrum.io/rpc';
const ORACLE_KEY_RAW = process.env.ORACLE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';

function normalizePrivateKey(key: string) {
  if (!key) throw new Error('private key is empty');
  let k = key.trim();
  // remove surrounding quotes if present
  if ((k.startsWith("\"") && k.endsWith("\"")) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  // ensure 0x prefix
  if (!k.startsWith('0x')) k = '0x' + k;
  const hex = k.slice(2);
  // must be 32 bytes (64 hex chars)
  if (!/^[0-9a-fA-F]+$/.test(hex) || !(hex.length === 64)) {
    throw new Error('invalid private key format; expected 32-byte hex string');
  }
  return ('0x' + hex).toLowerCase();
}

const ORACLE_KEY = normalizePrivateKey(ORACLE_KEY_RAW) as `0x${string}`;

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(ARB_RPC),
});

export const walletClient = createWalletClient({
  chain: arbitrumSepolia,
  account: privateKeyToAccount(ORACLE_KEY),
  transport: http(ARB_RPC),
});
