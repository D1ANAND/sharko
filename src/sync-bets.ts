import 'dotenv/config';
import { parseAbiItem } from 'viem';
import { publicClient } from './chain';
import { supabase } from './supabase';

const CUSTODY_ADDRESS = (process.env.CUSTODY_ADDRESS || '0x0') as `0x${string}`;

/**
 * Syncs on-chain bet events to Supabase bets table
 * This should be run periodically or triggered by new blocks
 */
export async function syncBetsToSupabase(fromBlock: bigint = 0n) {
    try {
        console.log(`Syncing bets from block ${fromBlock}...`);

        // Get all BetPlaced events
        const logs = await publicClient.getLogs({
            address: CUSTODY_ADDRESS,
            event: parseAbiItem('event BetPlaced(bytes32 indexed marketId, address indexed user, bool side, uint256 amount)'),
            fromBlock,
        });

        console.log(`Found ${logs.length} bet events`);

        for (const log of logs) {
            const { marketId, user, side, amount } = log.args;

            // Convert marketId bytes32 back to string (you'll need to store the mapping)
            // For now, we'll use the hex representation
            const marketIdHex = marketId as string;

            // Convert amount from wei to ETH
            const amountEth = Number(amount) / 1e18;

            // Check if bet already exists (to avoid duplicates)
            const { data: existing } = await supabase
                .from('bets')
                .select('id')
                .eq('market_id', marketIdHex)
                .eq('user_address', user)
                .eq('side', side)
                .eq('amount', amountEth)
                .single();

            if (existing) {
                console.log(`Bet already synced: ${user} on ${marketIdHex}`);
                continue;
            }

            // Insert bet into Supabase
            const { error } = await supabase
                .from('bets')
                .insert({
                    market_id: marketIdHex,
                    user_address: user as string,
                    side: side as boolean,
                    amount: amountEth,
                });

            if (error) {
                console.error(`Error inserting bet:`, error);
            } else {
                console.log(`✅ Synced bet: ${user} on ${marketIdHex}`);
            }
        }

        console.log('Sync complete!');
    } catch (error) {
        console.error('Error syncing bets:', error);
        throw error;
    }
}

// Run if called directly (when using tsx)
const fromBlock = process.argv[2] ? BigInt(process.argv[2]) : 0n;
syncBetsToSupabase(fromBlock)
    .then(() => {
        console.log('✅ Sync completed successfully');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Sync failed:', err);
        process.exit(1);
    });
