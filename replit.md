# Groked.dev Backend

## Project Overview
A production-ready backend for an AI-powered Solana memecoin management system. Grok4 deploys memecoins on Pump.fun, monitors X community messages, and autonomously manages creator rewards, burns, buybacks, holder snapshots, and airdrops.

**Repository:** https://github.com/grokeddev/backend
**Domain:** https://groked.dev

## Architecture

### Tech Stack
- **Runtime:** Node.js 20+
- **Framework:** Express.js with TypeScript
- **Blockchain:** Solana (@solana/web3.js, @solana/spl-token)
- **Validation:** Zod with drizzle-zod
- **Storage:** In-memory (PostgreSQL ready with Drizzle ORM)

### Project Structure
```
├── server/
│   ├── index.ts          # Express server entry
│   ├── routes.ts         # All API routes
│   ├── storage.ts        # Data storage interface
│   └── services/
│       ├── solana.ts     # Solana blockchain operations
│       └── pumpportal.ts # Pump.fun & PumpPortal API integration
├── shared/
│   └── schema.ts         # TypeScript types & Zod schemas
├── client/               # Frontend (minimal, backend-focused project)
└── README.md             # Full API documentation
```

## Core Features

### 1. Token Deployment (PumpPortal)
- Deploy memecoins via https://pumpportal.fun/creation
- IPFS metadata upload
- Initial buy support

### 2. Market Data (Pump.fun API)
- Real-time marketcap from https://frontend-api-v3.pump.fun
- Bonding curve progress tracking
- Graduation status

### 3. Creator Rewards (PumpPortal)
- Claim fees via https://pumpportal.fun/creator-fee/
- Track pending rewards

### 4. Wallet Management (Solana Web3.js)
- Generate keypairs
- SOL and SPL token transfers
- Balance queries

### 5. Holder Snapshots (Helius Pro)
- Fetch token holders
- Calculate distribution percentages
- Store snapshots for airdrops

### 6. Token Operations
- Burn tokens (reduce supply)
- Buyback tokens (market support)
- Airdrop SOL or tokens to holders

### 7. Activity Logging
- Track all AI decisions
- Log transactions and outcomes
- Store AI reasoning/thoughts

## Environment Variables
```
SOLANA_RPC_URL      # Optional: Defaults to mainnet
HELIUS_API_KEY      # Required for holder snapshots
XAI_API_KEY         # Required for Grok AI features
X_BEARER_TOKEN      # Required for X API read access
X_API_KEY           # Required for X API
X_API_SECRET        # Required for X API
X_ACCESS_TOKEN      # Required for X posting
X_ACCESS_SECRET     # Required for X posting
SESSION_SECRET      # Express session
```

## API Endpoints

### Core Endpoints
- `GET /api/health` - Health check
- `GET /api/dashboard` - Dashboard stats
- `GET /api/treasury` - Treasury balances

### Token Operations
- `POST /api/token/deploy` - Deploy new token
- `POST /api/burn` - Burn tokens
- `POST /api/buyback` - Buy tokens from market

### Holder Management
- `POST /api/snapshot` - Take holder snapshot
- `POST /api/airdrop` - Distribute tokens/SOL

### Rewards
- `POST /api/rewards/claim` - Claim creator rewards
- `GET /api/rewards/pending/:tokenMint` - Check pending

### Activity
- `GET /api/activity` - All activity logs
- `POST /api/activity/thought` - Log AI decision

### Grok AI
- `POST /api/ai/analyze-sentiment` - Analyze community sentiment
- `POST /api/ai/get-decision` - Get AI decision
- `POST /api/ai/generate-response` - Generate X response
- `POST /api/ai/community-insight` - Full community analysis

### X (Twitter) API
- `GET /api/x/status` - Check X API configuration
- `GET /api/x/mentions` - Search community mentions
- `POST /api/x/analyze-and-respond` - Analyze and auto-reply
- `POST /api/x/post` - Post a tweet
- `POST /api/x/reply` - Reply to a tweet

### Autonomous Agent
- `POST /api/agent/run-cycle` - Run full AI agent cycle

## Development Notes

### Running the Project
```bash
npm run dev
```

### Testing Endpoints
Use curl or Postman against http://localhost:5000/api/*

### Important Files
- `shared/schema.ts` - All data models and validation
- `server/routes.ts` - API endpoints
- `server/services/solana.ts` - Blockchain operations
- `server/services/pumpportal.ts` - Pump.fun integration
- `server/services/grok.ts` - xAI/Grok4 AI service
- `server/services/twitter.ts` - X (Twitter) API v2 service
