import {
  createWalletClient,
  custom,
  parseEther,
  parseAbi,
  encodeFunctionData,
  keccak256,
  toHex,
  formatEther
} from 'viem';
import { arbitrumSepolia } from 'viem/chains';

// Extend Window interface to include ethereum property from wallet providers
declare global {
  interface Window {
    ethereum?: any;
  }
}

const API_BASE = 'http://localhost:3001';
const CUSTODY = import.meta.env.VITE_CUSTODY_ADDRESS as `0x${string}`;

const ABI = parseAbi([
  'function deposit() payable',
  'function placeBet(bytes32 marketId, bool side, uint256 amount)',
  'function claim(bytes32 marketId)',
  'function withdraw(uint256 amount)',
  'function getBalance(address user) view returns (uint256)'
]);

let walletClient: any;
let address: `0x${string}`;

// Connect wallet
document.getElementById('connect')!.onclick = async () => {
  const ethereum = (window as any).ethereum;
  if (!ethereum?.request) {
    alert(
      'No Ethereum wallet found. Install MetaMask, or if you use another wallet, disable other wallet extensions (they can block the provider) and refresh.'
    );
    return;
  }
  try {
    walletClient = createWalletClient({
      chain: arbitrumSepolia,
      transport: custom(ethereum)
    });

    [address] = await walletClient.requestAddresses();

    document.getElementById('user-info')!.innerHTML = `${address.slice(0, 6)}...${address.slice(-4)}`;
    document.getElementById('user-info')!.style.display = 'block';
    document.getElementById('connect')!.style.display = 'none';

    // Auto deposit
    await deposit();

    loadMarkets();
    loadLeaderboard();
  } catch (err) {
    alert('Connection failed: ' + (err as Error).message);
  }
};

async function deposit() {
  const hash = await walletClient.sendTransaction({
    account: address,
    to: CUSTODY,
    data: encodeFunctionData({ abi: ABI, functionName: 'deposit' }),
    value: parseEther('0.01')
  });
  console.log('Deposited:', hash);
}

async function loadMarkets() {
  const resp = await fetch(`${API_BASE}/api/markets`);
  const markets = await resp.json();

  document.getElementById('markets')!.innerHTML = markets.map((m: any) => `
    <div class="market">
      <h3>${m.question}</h3>
      <div class="market-stats">
        <span>📊 ${(m.probability * 100).toFixed(0)}%</span>
        <span>💰 $${m.volume.toFixed(0)}</span>
      </div>
      <div class="bet-buttons">
        <button class="bet-yes" onclick="bet('${m.id}', true)">YES $0.001</button>
        <button class="bet-no" onclick="bet('${m.id}', false)">NO $0.001</button>
      </div>
    </div>
  `).join('');
}

(window as any).bet = async (marketId: string, side: boolean) => {
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
  } catch (err) {
    alert('Bet failed: ' + (err as Error).message);
  }
};


async function loadLeaderboard() {
  const resp = await fetch(`${API_BASE}/api/leaderboard`);
  const data = await resp.json();

  document.getElementById('leaderboard-body')!.innerHTML = data.leaders.map((l: any, i: number) => `
    <tr>
      <td class="rank">#${i + 1}</td>
      <td>${l.ensName}</td>
      <td style="color:${l.pnl > 0 ? '#10b981' : '#ef4444'}">
        ${l.pnl > 0 ? '+' : ''}${l.pnl.toFixed(4)} ETH
      </td>
      <td>${l.bets}</td>
      <td>${l.winRate}%</td>
    </tr>
  `).join('');
}

// Auto-load on page load
loadMarkets();
loadLeaderboard();
setInterval(loadLeaderboard, 30000);
