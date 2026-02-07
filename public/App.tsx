import React, { useState, useEffect } from 'react';
import {
    createWalletClient,
    custom,
    parseEther,
    parseAbi,
    encodeFunctionData,
    keccak256,
    toHex,
} from 'viem';
import { arbitrumSepolia } from 'viem/chains';

const API_BASE = 'http://localhost:3001';
const CUSTODY = `0x4bA6e7b6ecFDc54d5C56B1f764a261D5F2BFb8da` as `0x${string}`;

const ABI = parseAbi([
    'function deposit() payable',
    'function placeBet(bytes32 marketId, bool side, uint256 amount)',
    'function claim(bytes32 marketId)',
    'function withdraw(uint256 amount)',
    'function getBalance(address user) view returns (uint256)',
]);

interface Market {
    id: string;
    question: string;
    probability: number;
    volume: number;
    isResolved: boolean;
}

interface LeaderboardEntry {
    ensName: string;
    pnl: number;
    bets: number;
    winRate: string;
}

function App() {
    const [walletClient, setWalletClient] = useState<any>(null);
    const [address, setAddress] = useState<string>('');
    const [markets, setMarkets] = useState<Market[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMarkets();
        loadLeaderboard();
        const interval = setInterval(loadLeaderboard, 30000);
        return () => clearInterval(interval);
    }, []);

    const connectWallet = async () => {
        const ethereum = (window as any).ethereum;
        if (!ethereum?.request) {
            alert(
                'No Ethereum wallet found. Install MetaMask, or if you use another wallet, disable other wallet extensions (they can block the provider) and refresh.'
            );
            return;
        }

        try {
            const client = createWalletClient({
                chain: arbitrumSepolia,
                transport: custom(ethereum),
            });

            const [addr] = await client.requestAddresses();
            setWalletClient(client);
            setAddress(addr);

            // Auto deposit
            await deposit(client, addr);
            await loadMarkets();
        } catch (err) {
            alert('Connection failed: ' + (err as Error).message);
        }
    };

    const deposit = async (client: any, addr: string) => {
        const hash = await client.sendTransaction({
            account: addr,
            to: CUSTODY,
            data: encodeFunctionData({ abi: ABI, functionName: 'deposit' }),
            value: parseEther('0.01'),
        });
        console.log('Deposited:', hash);
    };

    const placeBet = async (marketId: string, side: boolean) => {
        if (!walletClient || !address) {
            alert('Please connect your wallet first');
            return;
        }

        try {
            const marketIdBytes = keccak256(toHex(marketId));
            const data = encodeFunctionData({
                abi: ABI,
                functionName: 'placeBet',
                args: [marketIdBytes, side, parseEther('0.001')],
            });

            const hash = await walletClient.sendTransaction({
                account: address as `0x${string}`,
                to: CUSTODY,
                data,
            });

            alert(`Bet placed! Tx: ${hash.slice(0, 10)}...`);

            // Track market in Supabase
            await fetch(`${API_BASE}/api/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marketId }),
            });
        } catch (err) {
            alert('Bet failed: ' + (err as Error).message);
        }
    };

    const loadMarkets = async () => {
        try {
            const resp = await fetch(`${API_BASE}/api/markets`);
            const data = await resp.json();
            setMarkets(data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load markets:', error);
            setLoading(false);
        }
    };

    const loadLeaderboard = async () => {
        try {
            const resp = await fetch(`${API_BASE}/api/leaderboard`);
            const data = await resp.json();
            setLeaderboard(data.leaders || []);
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    };

    return (
        <div className="container">
            <header>
                <h1>🟡 Yellow Predictions</h1>
                <div>
                    {!address ? (
                        <button onClick={connectWallet}>Connect Wallet</button>
                    ) : (
                        <span className="user-info">
                            {address.slice(0, 6)}...{address.slice(-4)}
                        </span>
                    )}
                </div>
            </header>

            <div id="markets-section">
                <h2>Live Markets</h2>
                <div className="markets">
                    {loading ? (
                        <div className="loading">Loading markets...</div>
                    ) : markets.length === 0 ? (
                        <div className="loading">No markets available</div>
                    ) : (
                        markets.map((m) => (
                            <div key={m.id} className="market">
                                <h3>{m.question}</h3>
                                <div className="market-stats">
                                    <span>📊 {(m.probability * 100).toFixed(0)}%</span>
                                    <span>💰 ${m.volume.toFixed(0)}</span>
                                </div>
                                <div className="bet-buttons">
                                    <button
                                        className="bet-yes"
                                        onClick={() => placeBet(m.id, true)}
                                    >
                                        YES $0.001
                                    </button>
                                    <button
                                        className="bet-no"
                                        onClick={() => placeBet(m.id, false)}
                                    >
                                        NO $0.001
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="leaderboard">
                <h2>🏆 Leaderboard</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Player</th>
                            <th>PnL</th>
                            <th>Bets</th>
                            <th>Win Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="loading">
                                    Loading...
                                </td>
                            </tr>
                        ) : (
                            leaderboard.map((l, i) => (
                                <tr key={i}>
                                    <td className="rank">#{i + 1}</td>
                                    <td>{l.ensName}</td>
                                    <td style={{ color: l.pnl > 0 ? '#10b981' : '#ef4444' }}>
                                        {l.pnl > 0 ? '+' : ''}
                                        {l.pnl.toFixed(4)} ETH
                                    </td>
                                    <td>{l.bets}</td>
                                    <td>{l.winRate}%</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default App;
