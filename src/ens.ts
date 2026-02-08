import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const ensCache = new Map<string, { ensName: string; avatar?: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ALCHEMY_MAINNET || 'https://eth-mainnet.g.alchemy.com/v2/demo')
});

/** Resolve ENS name and avatar on L1 (mainnet). Works for addresses on Sepolia or mainnet. */
export async function getUserProfile(address: string): Promise<{ address: string; ensName: string; avatar?: string }> {
  const cached = ensCache.get(address);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { address, ensName: cached.ensName, avatar: cached.avatar };
  }

  try {
    const name = await ensClient.getEnsName({
      address: address as `0x${string}`
    });

    const ensName = name || `${address.slice(0, 6)}...${address.slice(-4)}`;
    let avatar: string | undefined;
    if (name) {
      try {
        avatar = await ensClient.getEnsAvatar({ name });
      } catch {
        // ignore avatar errors
      }
    }
    ensCache.set(address, { ensName, avatar, timestamp: Date.now() });

    return { address, ensName, avatar };
  } catch (error) {
    const fallback = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return { address, ensName: fallback };
  }
}

export async function batchResolveENS(addresses: string[]) {
  return Promise.all(addresses.map(addr => getUserProfile(addr)));
}
