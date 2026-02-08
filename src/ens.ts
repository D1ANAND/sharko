import { createPublicClient, http } from 'viem';
import { normalize } from 'viem/ens';
import { sepolia } from 'viem/chains';

const ensCache = new Map<string, { ensName: string; avatar?: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC || process.env.ARB_RPC || 'https://rpc.sepolia.org')
});

function isShortenedAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/.test(s) || s.length < 12;
}

/**
 * Resolve ENS name and avatar on Sepolia only (ENS Sepolia dapp, e.g. mikkey.eth).
 * Verifies by forward resolution (name -> address) before trusting the name.
 */
export async function getUserProfile(
  address: string,
  _options?: { chainId?: number }
): Promise<{ address: string; ensName: string; avatar?: string }> {
  const key = address.toLowerCase();
  const cached = ensCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { address, ensName: cached.ensName, avatar: cached.avatar };
  }

  const addr = address as `0x${string}`;
  const fallback = `${address.slice(0, 6)}...${address.slice(-4)}`;
  let name: string | null = null;
  let avatar: string | undefined;

  try {
    name = await sepoliaClient.getEnsName({ address: addr });
    if (name && !isShortenedAddress(name)) {
      const resolved = await sepoliaClient.getEnsAddress({
        name: normalize(name),
      });
      if (resolved == null || resolved.toLowerCase() !== address.toLowerCase()) {
        name = null;
      }
    } else {
      name = null;
    }
  } catch {
    name = null;
  }

  const ensName = name && !isShortenedAddress(name) ? name : fallback;
  if (name) {
    try {
      avatar = await sepoliaClient.getEnsAvatar({ name });
    } catch {
      // ignore avatar errors
    }
  }
  ensCache.set(key, { ensName, avatar, timestamp: Date.now() });

  return { address, ensName, avatar };
}

export async function batchResolveENS(addresses: string[]) {
  return Promise.all(addresses.map(addr => getUserProfile(addr)));
}
