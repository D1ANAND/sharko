import { supabase } from './supabase';
import { yellowClient } from './yellow';

export interface Session {
    id: string;
    user_address: string;
    yellow_session_id: string | null;
    initial_deposit: number;
    current_balance: number;
    total_bet_amount: number;
    total_won: number;
    total_lost: number;
    status: 'open' | 'closing' | 'closed';
    opened_at: string;
    closed_at: string | null;
    settlement_tx_hash: string | null;
}

export interface SessionBet {
    id: number;
    session_id: string;
    market_id: string;
    user_address: string;
    side: boolean;
    amount: number;
    settled: boolean;
    won: boolean | null;
    pnl: number | null;
}

export class SessionManager {
    /**
     * Open a new session (state channel) for a user
     */
    async openSession(userAddress: string, depositAmount: number): Promise<Session | null> {
        try {
            // Check if user already has an open session
            const existing = await this.getActiveSession(userAddress);
            if (existing) {
                console.warn(`User ${userAddress} already has an active session`);
                return existing;
            }

            // Create Yellow session (if Yellow is connected)
            let yellowSessionId: string | null = null;
            try {
                yellowSessionId = await yellowClient.openSession(userAddress, depositAmount);
            } catch (error) {
                console.warn('Yellow session creation failed, continuing with local session:', error);
            }

            // Create session in database
            const { data, error } = await supabase
                .from('sessions')
                .insert({
                    user_address: userAddress,
                    yellow_session_id: yellowSessionId,
                    initial_deposit: depositAmount,
                    current_balance: depositAmount,
                    status: 'open',
                })
                .select()
                .single();

            if (error) {
                console.error('Failed to create session:', error);
                return null;
            }

            console.log(`✅ Session opened for ${userAddress}: ${data.id}`);
            return data as Session;
        } catch (error) {
            console.error('Error opening session:', error);
            return null;
        }
    }

    /**
     * Get the active session for a user
     */
    async getActiveSession(userAddress: string): Promise<Session | null> {
        try {
            const { data, error } = await supabase
                .rpc('get_active_session', { user_addr: userAddress });

            if (error) {
                console.error('Error getting active session:', error);
                return null;
            }

            return data && data.length > 0 ? (data[0] as Session) : null;
        } catch (error) {
            console.error('Error in getActiveSession:', error);
            return null;
        }
    }

    /**
     * Place a bet within a session (off-chain)
     */
    async placeBet(
        sessionId: string,
        marketId: string,
        userAddress: string,
        side: boolean,
        amount: number
    ): Promise<{ success: boolean; bet_id?: number; new_balance?: number; error?: string }> {
        try {
            // Use the database function to place bet atomically
            const { data, error } = await supabase.rpc('place_session_bet', {
                _session_id: sessionId,
                _market_id: marketId,
                _user_address: userAddress,
                _side: side,
                _amount: amount,
            });

            if (error) {
                console.error('Error placing session bet:', error);
                return { success: false, error: error.message };
            }

            const result = data as { success: boolean; bet_id?: number; new_balance?: number; error?: string };

            if (result.success) {
                // Send bet to Yellow Network for off-chain relay
                yellowClient.send({
                    marketId,
                    side,
                    amount: amount.toString(),
                    user: userAddress,
                });

                console.log(`📊 Bet placed in session ${sessionId}: ${amount} ETH on ${side ? 'YES' : 'NO'}`);
            }

            return result;
        } catch (error) {
            console.error('Error in placeBet:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Get session details including current balance
     */
    async getSession(sessionId: string): Promise<Session | null> {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (error) {
                console.error('Error getting session:', error);
                return null;
            }

            return data as Session;
        } catch (error) {
            console.error('Error in getSession:', error);
            return null;
        }
    }

    /**
     * Get all bets for a session
     */
    async getSessionBets(sessionId: string): Promise<SessionBet[]> {
        try {
            const { data, error } = await supabase
                .from('session_bets')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error getting session bets:', error);
                return [];
            }

            return (data as SessionBet[]) || [];
        } catch (error) {
            console.error('Error in getSessionBets:', error);
            return [];
        }
    }

    /**
     * Close a session and prepare for settlement
     */
    async closeSession(sessionId: string): Promise<{ success: boolean; final_balance?: number; error?: string }> {
        try {
            // Get session details
            const session = await this.getSession(sessionId);
            if (!session) {
                return { success: false, error: 'Session not found' };
            }

            if (session.status !== 'open') {
                return { success: false, error: 'Session is not open' };
            }

            // Mark session as closing
            const { error } = await supabase
                .from('sessions')
                .update({
                    status: 'closing',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error closing session:', error);
                return { success: false, error: error.message };
            }

            // Close Yellow session if exists
            if (session.yellow_session_id) {
                try {
                    await yellowClient.closeSession(session.yellow_session_id);
                } catch (error) {
                    console.warn('Yellow session close failed:', error);
                }
            }

            console.log(`🔒 Session ${sessionId} marked for closing. Final balance: ${session.current_balance} ETH`);

            return {
                success: true,
                final_balance: session.current_balance,
            };
        } catch (error) {
            console.error('Error in closeSession:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Finalize session after on-chain settlement
     */
    async finalizeSession(sessionId: string, settlementTxHash: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('sessions')
                .update({
                    status: 'closed',
                    closed_at: new Date().toISOString(),
                    settlement_tx_hash: settlementTxHash,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error finalizing session:', error);
                return false;
            }

            console.log(`✅ Session ${sessionId} finalized with tx: ${settlementTxHash}`);
            return true;
        } catch (error) {
            console.error('Error in finalizeSession:', error);
            return false;
        }
    }

    /**
     * Settle all bets in a session when a market resolves
     */
    async settleBetsForMarket(marketId: string, resolvedYes: boolean): Promise<number> {
        try {
            const { data, error } = await supabase.rpc('settle_session_bets', {
                _market_id: marketId,
                _resolved_yes: resolvedYes,
            });

            if (error) {
                console.error('Error settling session bets:', error);
                return 0;
            }

            const result = data as { success: boolean; bets_settled: number };
            console.log(`✅ Settled ${result.bets_settled} session bets for market ${marketId}`);

            return result.bets_settled;
        } catch (error) {
            console.error('Error in settleBetsForMarket:', error);
            return 0;
        }
    }
}

export const sessionManager = new SessionManager();
