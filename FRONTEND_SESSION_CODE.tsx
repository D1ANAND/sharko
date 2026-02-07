// Frontend State Channel Integration - Quick Reference
// Add this to your App.tsx

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

const API_BASE = 'http://localhost:3001';
const CUSTODY = '0x4bA6e7b6ecFDc54d5C56B1f764a261D5F2BFb8da' as `0x${string}`;

// ============ ADD THESE STATE VARIABLES ============
const [sessionId, setSessionId] = useState<string | null>(null);
const [sessionBalance, setSessionBalance] = useState<number>(0);

// ============ MODIFIED: connectWallet ============
const connectWallet = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum?.request) {
        alert('No Ethereum wallet found. Install MetaMask and refresh.');
        return;
    }

    try {
        const [addr] = (await ethereum.request({
            method: 'eth_requestAccounts',
        })) as string[];

        const account = addr as `0x${string}`;

        // Switch to Sepolia
        try {
            await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }],
            });
        } catch (switchError: any) {
            if (switchError.code === 4902) {
                await ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0xaa36a7',
                        chainName: 'Sepolia',
                        nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://rpc.sepolia.org'],
                        blockExplorerUrls: ['https://sepolia.etherscan.io'],
                    }],
                });
            }
        }

        const client = createWalletClient({
            chain: sepolia,
            transport: custom(ethereum),
            account,
        });

        setWalletClient(client);
        setAddress(account);

        // ========== NEW: Open Session Instead of Direct Deposit ==========
        await openSession(client, account);
        await loadMarkets();
    } catch (err) {
        alert('Connection failed: ' + (err as Error).message);
    }
};

// ============ NEW: openSession Function ============
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
            data: encodeFunctionData({
                abi: parseAbi(['function deposit() payable']),
                functionName: 'deposit'
            }),
            value: parseEther(depositAmount.toString()),
            maxFeePerGas,
            maxPriorityFeePerGas,
        });

        console.log('Deposit tx:', hash);
        alert('Depositing... Please wait for confirmation.');

        // Wait for confirmation (optional - you can make this async)
        // await publicClient.waitForTransactionReceipt({ hash });

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
            alert(`Session opened! Balance: ${sessionData.session.balance} ETH`);
        } else {
            alert('Failed to open session: ' + sessionData.error);
        }
    } catch (err) {
        alert('Session open failed: ' + (err as Error).message);
    }
};

// ============ MODIFIED: placeBet (Off-chain) ============
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

        // Place bet via session (off-chain)
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
            alert(`Bet placed! New balance: ${result.newBalance} ETH (No gas fees! ⚡)`);
        } else {
            alert('Bet failed: ' + result.error);
        }
    } catch (err) {
        alert('Bet failed: ' + (err as Error).message);
    }
};

// ============ NEW: closeSession Function ============
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
        alert(`Session closed! Withdrew ${finalBalance} ETH`);
    } catch (err) {
        alert('Session close failed: ' + (err as Error).message);
    }
};

// ============ UI ADDITIONS ============
// Add this to your JSX, after the header:

{
    sessionId && (
        <div className="session-info" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
            borderRadius: '12px',
            margin: '20px 0',
            color: 'white',
        }}>
            <h3 style={{ margin: '0 0 10px 0' }}>🟡 Active Yellow Session</h3>
            <p style={{ margin: '5px 0', fontSize: '18px' }}>
                <strong>Balance:</strong> {sessionBalance.toFixed(4)} ETH
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
                }}
            >
                End Session & Withdraw
            </button>
        </div>
    )
}

// ============ UPDATE BET BUTTONS ============
// Modify your bet buttons to show "No Gas!" and disable if no session:

<button
    className="bet-yes"
    onClick={() => placeBet(m.id, true)}
    disabled={!sessionId || sessionBalance < 0.001}
>
    YES 0.001 ETH {sessionId && '⚡ No Gas!'}
</button>
