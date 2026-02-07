#!/bin/bash
set -e

echo "🚀 Deploying Yellow Manifold dApp"

# 1. Deploy contract
echo "1️⃣ Deploying PredictionCustody..."
forge create \
  --rpc-url $ARB_RPC \
  --private-key $ORACLE_KEY \
  --constructor-args $(cast wallet address $ORACLE_KEY) \
  contracts/PredictionCustody.sol:PredictionCustody

echo "✅ Contract deployed! Update .env with address"

# 2. Install deps
echo "2️⃣ Installing dependencies..."
npm install

# 3. Build
echo "3️⃣ Building..."
npm run build

# 4. Test backend
echo "4️⃣ Testing backend..."
npm run dev &
sleep 5
curl http://localhost:3001/api/health
kill %1

echo "✅ Backend works!"

# 5. Deploy frontend
echo "5️⃣ Deploy frontend with: vercel --prod"
echo "   Update index.html CUSTODY address first!"

echo "🎉 Done! Update .env and index.html, then deploy."
