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
