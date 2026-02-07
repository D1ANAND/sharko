# 🟡 Yellow Manifold Prediction Markets

**Gasless prediction market dApp using Yellow Network, Manifold oracles, and ENS.**

## Architecture
- **Frontend**: Viem + MetaMask on Arbitrum Sepolia
- **Backend**: Node.js + Express + SQLite
- **Smart Contract**: PredictionCustody.sol (deposits, bets, settlement)
- **Oracles**: Manifold Markets API
- **Identity**: ENS resolution
- **UX**: Yellow Network state channels

## Setup

### 1. Install
```bash
npm install
forge install
```

### 2. Run (important)
- **Backend:** `npm run dev` (API on port 3001)
- **Frontend:** `npm run dev:frontend` then open **http://localhost:5173** (do not open `index.html` via file:// — the app must be served by Vite so `.ts` is compiled and served with the correct MIME type).
- **Wallet:** Use only one Ethereum wallet extension (e.g. MetaMask). Having multiple wallets can cause "Cannot set property ethereum" because another extension may lock `window.ethereum` as a getter-only property.
