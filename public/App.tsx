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
import { sepolia } from 'viem/chains';

const API_BASE = 'http://localhost:3001'; // backend PORT = 3001

// Copy the same address you have in CUSTODY_ADDRESS in your .env
const CUSTODY = '0x4bA6e7b6ecFDc54d5C56B1f764a261D5F2BFb8da' as `0x${string}`;

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
    const [walletClient, setWalletClient] = useState<ReturnType<typeof createWalletClient> | null>(null);
    const [address, setAddress] = useState<`0x${string}` | null>(null);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Yellow Network state channel session
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionBalance, setSessionBalance] = useState<number>(0);

    useEffect(() => {
        loadMarkets();
        loadLeaderboard();
        const interval = setInterval(loadLeaderboard, 30000);
        return () => clearInterval(interval);
    }, []);

    const connectWallet = async () => {
        const ethereum = (window as any).ethereum;
        if (!ethereum?.request) {
            alert('No Ethereum wallet found. Install MetaMask and refresh.');
            return;
        }

        try {
            // Request accounts from MetaMask
            const [addr] = (await ethereum.request({
                method: 'eth_requestAccounts',
            })) as string[];

            const account = addr as `0x${string}`;

            // Switch to Sepolia network
            try {
                await ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID in hex
                });
            } catch (switchError: any) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        await ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: '0xaa36a7',
                                chainName: 'Sepolia',
                                nativeCurrency: {
                                    name: 'Sepolia ETH',
                                    symbol: 'ETH',
                                    decimals: 18,
                                },
                                rpcUrls: ['https://rpc.sepolia.org'],
                                blockExplorerUrls: ['https://sepolia.etherscan.io'],
                            }],
                        });
                    } catch (addError) {
                        throw new Error('Failed to add Sepolia network to MetaMask');
                    }
                } else {
                    throw switchError;
                }
            }

            // Create wallet client with attached account
            const client = createWalletClient({
                chain: sepolia,
                transport: custom(ethereum),
                account,
            });

            setWalletClient(client);
            setAddress(account);

            // Open Yellow Network session
            await openSession(client, account);
            await loadMarkets();
        } catch (err) {
            alert('Connection failed: ' + (err as Error).message);
        }
    };

    const openSession = async (client: ReturnType<typeof createWalletClient>, addr: `0x${string}`) => {
        try {
            const depositAmount = 0.01; // ETH to deposit

            // Get gas fees
            const resp = await fetch(`${API_BASE}/api/fees`);
            const feeData = await resp.json();

            const minPriorityFee = 1000000000n; // 1 gwei
            const priorityFee = BigInt(feeData.maxPriorityFeePerGas || 0);
            const maxPriorityFeePerGas = priorityFee > minPriorityFee ? priorityFee : minPriorityFee;

            const baseFee = BigInt(feeData.maxFeePerGas || 0);
            const minMaxFee = maxPriorityFeePerGas * 2n;
            const calculatedMaxFee = baseFee * 2n + maxPriorityFeePerGas;
            const maxFeePerGas = calculatedMaxFee > minMaxFee ? calculatedMaxFee : minMaxFee;

            // 1. On-chain deposit
            const hash = await client.sendTransaction({
                chain: sepolia,
                account: addr,
                to: CUSTODY,
                data: encodeFunctionData({ abi: ABI, functionName: 'deposit' }),
                value: parseEther(depositAmount.toString()),
                maxFeePerGas,
                maxPriorityFeePerGas,
            });

            console.log('Deposit tx:', hash);
            alert('Depositing... Opening Yellow session...');

            // 2. Open session in backend
            const sessionResp = await fetch(`${API_BASE}/api/session/open`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAddress: addr,
                    depositAmount,
                }),
            });

            const sessionData = await sessionResp.json();

            if (sessionData.success) {
                setSessionId(sessionData.session.id);
                setSessionBalance(sessionData.session.balance);
                alert(`🟡 Yellow Session Opened! Balance: ${sessionData.session.balance} ETH\n\nYou can now place bets with NO GAS FEES! ⚡`);
            } else {
                alert('Failed to open session: ' + sessionData.error);
            }
        } catch (err) {
            alert('Session open failed: ' + (err as Error).message);
        }
    };

    const deposit = async (client: ReturnType<typeof createWalletClient>, addr: `0x${string}`) => {
        try {
            const resp = await fetch(`${API_BASE}/api/fees`);
            const feeData = await resp.json();

            // Ensure minimum 1 gwei for priority fee
            const minPriorityFee = 1000000000n; // 1 gwei in wei
            const priorityFee = BigInt(feeData.maxPriorityFeePerGas || 0);
            const maxPriorityFeePerGas = priorityFee > minPriorityFee ? priorityFee : minPriorityFee;

            // Ensure maxFeePerGas is at least maxPriorityFeePerGas + base fee
            const baseFee = BigInt(feeData.maxFeePerGas || 0);
            const minMaxFee = maxPriorityFeePerGas * 2n; // At least 2x priority fee
            const calculatedMaxFee = baseFee * 2n + maxPriorityFeePerGas;
            const maxFeePerGas = calculatedMaxFee > minMaxFee ? calculatedMaxFee : minMaxFee;

            const hash = await client.sendTransaction({
                chain: sepolia,
                account: addr,
                to: CUSTODY,
                data: encodeFunctionData({ abi: ABI, functionName: 'deposit' }),
                value: parseEther('0.01'),
                maxFeePerGas,
                maxPriorityFeePerGas,
            });

            console.log('Deposited:', hash);
        } catch (err) {
            alert('Deposit failed: ' + (err as Error).message);
        }
    };

    const placeBet = async (marketId: string, side: boolean) => {
        if (!walletClient || !address || !sessionId) {
            alert('Please connect your wallet and open a session first');
            return;
        }

        try {
            const betAmount = 0.001; // ETH

            // Check balance
            if (sessionBalance < betAmount) {
                alert('Insufficient session balance. Please close session and open a new one.');
                return;
            }

            // Place bet via session (off-chain, no gas!)
            const resp = await fetch(`${API_BASE}/api/session/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    marketId,
                    userAddress: address,
                    side,
                    amount: betAmount,
                }),
            });

            const result = await resp.json();

            if (result.success) {
                setSessionBalance(result.newBalance);
                alert(`✅ Bet placed! New balance: ${result.newBalance.toFixed(4)} ETH\n\n⚡ NO GAS FEES! Instant confirmation via Yellow Network!`);
            } else {
                alert('Bet failed: ' + result.error);
            }
        } catch (err) {
            alert('Bet failed: ' + (err as Error).message);
        }
    };

    const closeSession = async () => {
        if (!walletClient || !address || !sessionId) {
            alert('No active session');
            return;
        }

        try {
            // 1. Close session in backend
            const closeResp = await fetch(`${API_BASE}/api/session/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });

            const closeData = await closeResp.json();

            if (!closeData.success) {
                alert('Failed to close session: ' + closeData.error);
                return;
            }

            const finalBalance = closeData.finalBalance;
            alert(`Session closing. Final balance: ${finalBalance} ETH. Withdrawing...`);

            // 2. Withdraw on-chain
            const resp = await fetch(`${API_BASE}/api/fees`);
            const feeData = await resp.json();

            const minPriorityFee = 1000000000n;
            const priorityFee = BigInt(feeData.maxPriorityFeePerGas || 0);
            const maxPriorityFeePerGas = priorityFee > minPriorityFee ? priorityFee : minPriorityFee;

            const baseFee = BigInt(feeData.maxFeePerGas || 0);
            const minMaxFee = maxPriorityFeePerGas * 2n;
            const calculatedMaxFee = baseFee * 2n + maxPriorityFeePerGas;
            const maxFeePerGas = calculatedMaxFee > minMaxFee ? calculatedMaxFee : minMaxFee;

            const hash = await walletClient.writeContract({
                address: CUSTODY,
                abi: parseAbi(['function withdraw(uint256 amount)']),
                functionName: 'withdraw',
                args: [parseEther(finalBalance.toString())],
                chain: sepolia,
                account: address,
                maxFeePerGas,
                maxPriorityFeePerGas,
            });

            console.log('Withdraw tx:', hash);

            // 3. Finalize session
            await fetch(`${API_BASE}/api/session/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    txHash: hash,
                }),
            });

            setSessionId(null);
            setSessionBalance(0);
            alert(`🎉 Session closed! Withdrew ${finalBalance} ETH`);
        } catch (err) {
            alert('Session close failed: ' + (err as Error).message);
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

            {sessionId && (
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '20px',
                    borderRadius: '12px',
                    margin: '20px 0',
                    color: 'white',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>🟡 Active Yellow Session</h3>
                    <p style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold' }}>
                        Balance: {sessionBalance.toFixed(4)} ETH
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>
                        ⚡ Place bets with NO GAS FEES via Yellow Network!
                    </p>
                    <button
                        onClick={closeSession}
                        style={{
                            marginTop: '10px',
                            padding: '10px 20px',
                            background: 'rgba(255,255,255,0.2)',
                            border: '2px solid white',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px',
                        }}
                    >
                        End Session & Withdraw
                    </button>
                </div>
            )}

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
                                        disabled={!sessionId || sessionBalance < 0.001}
                                    >
                                        YES 0.001 ETH {sessionId && '⚡'}
                                    </button>
                                    <button
                                        className="bet-no"
                                        onClick={() => placeBet(m.id, false)}
                                        disabled={!sessionId || sessionBalance < 0.001}
                                    >
                                        NO 0.001 ETH {sessionId && '⚡'}
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
