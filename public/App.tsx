import React, { useState, useEffect, useRef } from 'react';
import {
    createWalletClient,
    createPublicClient,
    http,
    custom,
    parseEther,
    parseAbi,
    encodeFunctionData,
    keccak256,
    toHex,
} from 'viem';
import { sepolia, mainnet } from 'viem/chains';

const API_BASE = 'http://localhost:3001'; // backend PORT = 3001

// Copy the same address you have in CUSTODY_ADDRESS in your .env
const CUSTODY = '0x2F4629D3D04B98ABa5d559fa67783C064484c0E2' as `0x${string}`;

const ABI = parseAbi([
    'function deposit() payable',
    'function placeBet(bytes32 marketId, bool side, uint256 amount)',
    'function claim(bytes32 marketId)',
    'function withdraw(uint256 amount)',
    'function getBalance(address user) view returns (uint256)',
]);

// --- Landing Page Components ---

const Hero = ({
    isSessionActive,
    onStartPredicting,
    onWatchDemo,
}: {
    isSessionActive: boolean;
    onStartPredicting: () => void;
    onWatchDemo: () => void;
}) => (
    <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-status">
            <span>Powered by Yellow Network State Channels</span>
            <span className="hero-status-dot" data-connected={isSessionActive} />
            <span>Yellow: {isSessionActive ? 'connected' : 'disconnected'}</span>
        </div>
        <h1 className="hero-title">
            Predict the Future,<br />
            <span className="hero-title-accent">Earn Rewards</span>
        </h1>
        <p className="hero-subtitle">
            Decentralized prediction marketplace with instant finality, zero gas fees, and cryptographic security powered by ERC-7824 state channels.
        </p>
        <div className="hero-ctas">
            <button type="button" className="btn-primary" onClick={onStartPredicting}>
                Start Predicting
            </button>
            <button type="button" className="btn-secondary" onClick={onWatchDemo}>
                Watch Demo
            </button>
        </div>
    </section>
);

const FEATURES = [
    { title: 'Instant Finality', description: 'Predictions settle instantly off-chain with cryptographic security guarantees using ERC-7824 state channels.', icon: '⚡' },
    { title: 'Zero Gas Fees', description: 'Make unlimited predictions without gas costs. Only pay for final tournament settlements on-chain.', icon: '🛡️' },
    { title: 'Trustless Security', description: 'All predictions are cryptographically signed and verifiable with blockchain-level security.', icon: '🔐' },
];

const Features = () => (
    <section className="features">
        <h2 className="features-title">Powered by Yellow Network</h2>
        <p className="features-subtitle">
            Built on cutting-edge state channel technology for instant, gasless predictions
        </p>
        <div className="features-grid">
            {FEATURES.map((f) => (
                <div key={f.title} className="feature-card">
                    <div className="feature-icon">{f.icon}</div>
                    <h3 className="feature-title">{f.title}</h3>
                    <p className="feature-desc">{f.description}</p>
                </div>
            ))}
        </div>
    </section>
);

const HOW_IT_WORKS = [
    { step: 1, title: 'Connect & Deposit', desc: 'Connect your wallet and fund your state channel with ETH. No gas fees for placing predictions.' },
    { step: 2, title: 'Choose Markets', desc: 'Browse live prediction markets across sports, politics, crypto, and more. Pick your side.' },
    { step: 3, title: 'Predict Instantly', desc: 'Place YES or NO bets that settle off-chain in real time with cryptographic guarantees.' },
    { step: 4, title: 'Withdraw Anytime', desc: 'Close your channel and withdraw your balance back to your wallet whenever you want.' },
];

const HowItWorks = () => (
    <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">
            Get started in four simple steps. No complex setup—just connect, deposit, and predict.
        </p>
        <div className="steps-grid">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
                <div key={step} className="step-card">
                    <span className="step-number">{step}</span>
                    <h3 className="step-title">{title}</h3>
                    <p className="step-desc">{desc}</p>
                </div>
            ))}
        </div>
    </section>
);

const STATS = [
    { value: '5+', label: 'Active Predictors' },
    { value: '500+', label: 'Live Markets' },
    { value: 'Zero', label: 'Gas on Predictions' },
];

const Stats = () => (
    <section className="stats-strip">
        <div className="stats-inner">
            {STATS.map(({ value, label }) => (
                <div key={label} className="stat-item">
                    <span className="stat-value">{value}</span>
                    <span className="stat-label">{label}</span>
                </div>
            ))}
        </div>
    </section>
);

const CtaBlock = ({ onGoToMarkets }: { onGoToMarkets: () => void }) => (
    <section className="cta-block">
        <h2 className="cta-title">Ready to predict?</h2>
        <p className="cta-subtitle">Join thousands of users making instant, gasless predictions on real-world events.</p>
        <button type="button" className="btn-primary cta-btn" onClick={onGoToMarkets}>
            Go to Markets
        </button>
    </section>
);

const Footer = ({ onGoToMarkets, onGoToLeaderboard }: { onGoToMarkets: () => void; onGoToLeaderboard: () => void }) => (
    <footer className="footer">
        <div className="footer-inner">
            <div className="footer-brand">
                <div className="footer-logo">
                    <span className="footer-logo-icon">S</span>
                    <span className="footer-logo-text">Sharko</span>
                </div>
                <p className="footer-desc">
                    The future of decentralized prediction markets, powered by Yellow Network&apos;s state channel technology.
                </p>
                <div className="footer-social">
                    <a href="https://github.com/D1ANAND/sharko" target="_blank" rel="noopener noreferrer" className="footer-social-link" title="GitHub">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                    </a>
                </div>
            </div>
            <div className="footer-links">
                <div className="footer-col">
                    <h4>Product</h4>
                    <ul>
                        <li><button type="button" className="footer-link" onClick={onGoToMarkets}>Markets</button></li>
                        <li><a href="#" className="footer-link">Tournaments</a></li>
                        <li><button type="button" className="footer-link" onClick={onGoToLeaderboard}>Leaderboard</button></li>
                        <li><a href="#" className="footer-link">Analytics</a></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>Developers</h4>
                    <ul>
                        <li><a href="#" className="footer-link">Documentation</a></li>
                        <li><a href="#" className="footer-link">Nitrolite SDK</a></li>
                        <li><a href="#" className="footer-link">API Reference</a></li>
                        <li><a href="https://github.com/D1ANAND/sharko" target="_blank" rel="noopener noreferrer" className="footer-link">GitHub</a></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>Resources</h4>
                    <ul>
                        <li><a href="#" className="footer-link">Blog</a></li>
                        <li><a href="#" className="footer-link">Help Center</a></li>
                        <li><a href="#" className="footer-link">Community</a></li>
                        <li><a href="#" className="footer-link">Status</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>
);

interface Market {
    id: string;
    question: string;
    probability: number;
    volume: number;
    isResolved: boolean;
    groupSlugs?: string[]; // Add optional groupSlugs
}


interface LeaderboardEntry {
    ensName: string;
    avatar?: string;
    address?: string;
    pnl: number;
    bets: number;
    winRate: string;
    rank?: number;
    volume?: number;
    lastUpdated?: string;
}

// Define the categories matching the image
const CATEGORIES = [
    'All', 'Politics', 'Technology', 'Sports', 'Culture',
    'Business', 'Fun', 'Super Bowl', 'Football', 'World', 'Sports Betting'
];

function App() {
    const [page, setPage] = useState<'landing' | 'markets'>('landing');
    const [walletClient, setWalletClient] = useState<ReturnType<typeof createWalletClient> | null>(null);
    const [address, setAddress] = useState<`0x${string}` | null>(null);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [userEnsName, setUserEnsName] = useState<string | null>(null);
    const [userEnsAvatar, setUserEnsAvatar] = useState<string | null>(null);

    // Yellow Network state channel session
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionBalance, setSessionBalance] = useState<number>(0);
    const [selectedCategory, setSelectedCategory] = useState('All');

    const leaderboardRef = useRef<HTMLDivElement>(null);
    const scrollToLeaderboardAfterNav = useRef(false);

    useEffect(() => {
        loadMarkets();
        loadLeaderboard();
    }, []);

    // Resolve ENS primary name for connected wallet using viem (client-side)
    useEffect(() => {
        if (!address) {
            setUserEnsName(null);
            setUserEnsAvatar(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                console.log('🔍 Resolving ENS for address:', address);

                // Create a public client for Sepolia testnet to resolve ENS
                // Using Alchemy's Sepolia RPC endpoint
                const publicClient = createPublicClient({
                    chain: sepolia,
                    transport: http('https://eth-sepolia.g.alchemy.com/v2/PuciTLIfFiQrrhuVIkGAm'),
                });

                // Get ENS name from Sepolia (reverse resolution)
                let ensName = await publicClient.getEnsName({
                    address: address,
                });

                console.log('✅ ENS reverse resolution result:', ensName || 'No primary name set');

                // If reverse resolution fails, try forward resolution for known name
                if (!ensName) {
                    console.log('🔄 Trying forward resolution for mikkey.eth...');
                    try {
                        const resolvedAddress = await publicClient.getEnsAddress({
                            name: 'mikkey.eth',
                        });
                        console.log('📍 mikkey.eth resolves to:', resolvedAddress);

                        // If mikkey.eth points to this address, use it
                        if (resolvedAddress?.toLowerCase() === address.toLowerCase()) {
                            console.log('✅ Found matching ENS name: mikkey.eth');
                            ensName = 'mikkey.eth';
                        }
                    } catch (err) {
                        console.log('⚠️ Forward resolution failed:', err);
                    }
                }

                if (cancelled) return;
                setUserEnsName(ensName);

                // If we have an ENS name, fetch the avatar
                if (ensName) {
                    console.log('🖼️ Fetching avatar for:', ensName);
                    const ensAvatar = await publicClient.getEnsAvatar({
                        name: ensName,
                    });
                    console.log('✅ Avatar resolved:', ensAvatar || 'No avatar found');
                    if (!cancelled) {
                        setUserEnsAvatar(ensAvatar);
                    }
                } else {
                    setUserEnsAvatar(null);
                }
            } catch (error) {
                console.error('❌ ENS resolution error:', error);
                if (!cancelled) {
                    setUserEnsName(null);
                    setUserEnsAvatar(null);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [address]);

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
            // data structure from server: { leaders: [], stats: {} }
            if (data.leaders) {
                setLeaderboard(data.leaders);
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    };

    const goToMarketsPage = () => setPage('markets');
    const scrollToLeaderboard = () => {
        if (page === 'markets') {
            leaderboardRef.current?.scrollIntoView({ behavior: 'smooth' });
        } else {
            scrollToLeaderboardAfterNav.current = true;
            setPage('markets');
        }
    };

    useEffect(() => {
        if (page === 'markets' && scrollToLeaderboardAfterNav.current) {
            scrollToLeaderboardAfterNav.current = false;
            setTimeout(() => leaderboardRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }, [page]);

    const handleStartPredicting = () => {
        goToMarketsPage();
        if (!address) connectWallet();
    };
    const handleWatchDemo = () => goToMarketsPage();

    const filteredMarkets = markets.filter(m => {
        if (selectedCategory === 'All') return true;

        const search = selectedCategory.toLowerCase();
        const q = m.question.toLowerCase();

        // Match by group slugs if API provides them
        if (m.groupSlugs?.length) {
            const hasGroupMatch = m.groupSlugs.some(slug => {
                const normalizedSlug = slug.replace(/-/g, ' ').toLowerCase();
                // Check if the slug contains the search term or vice versa
                return normalizedSlug.includes(search) || search.includes(normalizedSlug);
            });
            if (hasGroupMatch) return true;
        }

        // Match full phrase in question
        if (q.includes(search)) return true;

        // Match any word in multi-word categories (e.g. "Sports Betting" → "sports" or "betting")
        const words = search.split(/\s+/).filter(Boolean);
        if (words.some(word => word.length > 1 && q.includes(word))) return true;

        // Special category mappings for better matching
        const categoryMappings: Record<string, string[]> = {
            'politics': ['election', 'president', 'congress', 'senate', 'vote', 'political', 'democrat', 'republican', 'biden', 'trump'],
            'technology': ['tech', 'ai', 'software', 'computer', 'crypto', 'bitcoin', 'ethereum', 'apple', 'google', 'meta', 'tesla'],
            'sports': ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'game', 'championship', 'super bowl'],
            'culture': ['movie', 'film', 'music', 'celebrity', 'entertainment', 'award', 'oscar', 'grammy'],
            'business': ['stock', 'market', 'economy', 'company', 'revenue', 'profit', 'ceo', 'ipo'],
            'super bowl': ['super bowl', 'superbowl', 'nfl championship'],
            'football': ['nfl', 'football', 'quarterback', 'touchdown'],
            'sports betting': ['bet', 'odds', 'spread', 'over', 'under']
        };

        const mappedKeywords = categoryMappings[search] || [];
        if (mappedKeywords.some(keyword => q.includes(keyword))) return true;

        return false;
    });

    // When a category returns no results, show all markets so something always renders
    const displayMarkets = filteredMarkets.length > 0 ? filteredMarkets : markets;
    const showFilterFallback = selectedCategory !== 'All' && filteredMarkets.length === 0;


    return (
        <div className="app">
            <header className="nav">
                <a
                    href="#"
                    className="nav-logo"
                    onClick={(e) => {
                        e.preventDefault();
                        setPage('landing');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                >
                    <span className="nav-logo-icon">S</span>
                    <span>Sharko</span>
                </a>
                <nav className="nav-links">
                    <button
                        type="button"
                        className={`nav-link ${page === 'markets' ? 'active' : ''}`}
                        onClick={() => setPage('markets')}
                    >
                        Markets
                    </button>
                    <button type="button" className="nav-link" onClick={scrollToLeaderboard}>
                        Leaderboard
                    </button>
                </nav>
                <div className="nav-actions">
                    {sessionId && (
                        <div className="nav-channel-badge">
                            ⚡ Channel: {sessionBalance.toFixed(4)} ETH
                        </div>
                    )}
                    {!address ? (
                        <button type="button" className="btn-primary btn-nav" onClick={connectWallet}>
                            Connect Wallet
                        </button>
                    ) : (
                        <div className="nav-wallet nav-wallet-ens">
                            {userEnsAvatar && (
                                <img src={userEnsAvatar} alt="" className="nav-wallet-avatar" />
                            )}
                            <div className="user-info-wrap">
                                <span className="user-info user-info-name">
                                    {userEnsName && !userEnsName.includes('...') ? userEnsName : address.slice(0, 6) + '...' + address.slice(-4)}
                                </span>
                            </div>
                            {sessionId && (
                                <button type="button" className="btn-outline-danger" onClick={closeSession}>
                                    Withdraw
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {page === 'landing' && (
                <>
                    <Hero
                        isSessionActive={!!sessionId}
                        onStartPredicting={handleStartPredicting}
                        onWatchDemo={handleWatchDemo}
                    />
                    <Features />
                    <HowItWorks />
                    <Stats />
                    <CtaBlock onGoToMarkets={goToMarketsPage} />
                    <Footer onGoToMarkets={goToMarketsPage} onGoToLeaderboard={scrollToLeaderboard} />
                </>
            )}

            {page === 'markets' && (
                <div className="markets-page">
                    <div className="container">
                        {sessionId && (
                            <div className="session-banner">
                                <h3>🟡 Active Yellow Session</h3>
                                <p className="session-balance">Balance: {sessionBalance.toFixed(4)} ETH</p>
                                <p className="session-desc">⚡ Place bets with NO GAS FEES via Yellow Network!</p>
                                <button type="button" className="btn-secondary session-close" onClick={closeSession}>
                                    End Session & Withdraw
                                </button>
                            </div>
                        )}
                        <div className="markets-section">
                            <h1 className="markets-page-title">Live Markets</h1>
                            <div className="filter-bar">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                                        onClick={() => setSelectedCategory(cat)}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            {showFilterFallback && (
                                <p className="filter-fallback-msg">No markets found for &quot;{selectedCategory}&quot;. Showing all markets.</p>
                            )}
                            <div className="markets">
                                {loading ? (
                                    <div className="loading">Loading markets...</div>
                                ) : displayMarkets.length === 0 ? (
                                    <div className="loading">No markets available.</div>
                                ) : (
                                    displayMarkets.map((m) => (
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
                        <div id="leaderboard" className="leaderboard" ref={leaderboardRef}>
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
                                            <tr key={l.address ?? i}>
                                                <td className="rank">#{i + 1}</td>
                                                <td className="leaderboard-player">
                                                    {l.avatar && <img src={l.avatar} alt="" className="leaderboard-avatar" />}
                                                    <span>{l.ensName}</span>
                                                </td>
                                                <td className={l.pnl > 0 ? 'pnl-positive' : 'pnl-negative'}>
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
                </div>
            )}
        </div>
    );
}

export default App;
