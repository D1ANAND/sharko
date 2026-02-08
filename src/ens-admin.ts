import { namehash, keccak256, toHex, parseAbi, encodeFunctionData, stringToHex } from 'viem';
import { walletClient, publicClient } from './chain';
import { normalize } from 'viem/ens';

// ENS Registry (Sepolia)
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
// Public Resolver (Sepolia)
const PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354433FA171EB0F1';

const PARENT_DOMAIN = 'charliechaplin.eth';

const REGISTRY_ABI = parseAbi([
    'function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl)'
]);

const RESOLVER_ABI = parseAbi([
    'function setText(bytes32 node, string key, string value)',
    'function multicall(bytes[] data)'
]);

export async function assignSubdomain(label: string, owner: string) {
    try {
        const parentNode = namehash(normalize(PARENT_DOMAIN));
        const labelHash = keccak256(stringToHex(label));

        console.log(`Assigning ${label}.${PARENT_DOMAIN} to ${owner}...`);

        const hash = await walletClient.writeContract({
            address: ENS_REGISTRY,
            abi: REGISTRY_ABI,
            functionName: 'setSubnodeRecord',
            args: [parentNode, labelHash, owner as `0x${string}`, PUBLIC_RESOLVER, 0n]
        });

        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`Subdomain assigned in tx: ${hash}`);
        return true;
    } catch (error) {
        console.error('Error assigning subdomain:', error);
        return false;
    }
}

export interface PredictionStats {
    totalBets: string;
    totalPnL: string;
    winRate: string;
    rank: string;
    lastUpdated: string;
}

export async function updateEnsStats(ensName: string, stats: PredictionStats) {
    try {
        const node = namehash(normalize(ensName));
        console.log(`Updating stats for ${ensName}...`);

        // Prepare multicall data for efficient updates
        const calls = [
            encodeFunctionData({
                abi: RESOLVER_ABI,
                functionName: 'setText',
                args: [node, 'prediction.totalBets', stats.totalBets]
            }),
            encodeFunctionData({
                abi: RESOLVER_ABI,
                functionName: 'setText',
                args: [node, 'prediction.totalPnL', stats.totalPnL]
            }),
            encodeFunctionData({
                abi: RESOLVER_ABI,
                functionName: 'setText',
                args: [node, 'prediction.winRate', stats.winRate]
            }),
            encodeFunctionData({
                abi: RESOLVER_ABI,
                functionName: 'setText',
                args: [node, 'prediction.rank', stats.rank]
            }),
            encodeFunctionData({
                abi: RESOLVER_ABI,
                functionName: 'setText',
                args: [node, 'prediction.lastUpdated', stats.lastUpdated]
            })
        ];

        const hash = await walletClient.writeContract({
            address: PUBLIC_RESOLVER,
            abi: RESOLVER_ABI,
            functionName: 'multicall',
            args: [calls]
        });

        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`Stats updated for ${ensName} in tx: ${hash}`);
        return true;
    } catch (error) {
        console.error(`Error updating stats for ${ensName}:`, error);
        return false;
    }
}
