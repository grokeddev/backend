# Groked.dev Backend

**Repository:** [github.com/grokeddev/backend](https://github.com/grokeddev/backend)  
**Domain:** [groked.dev](https://groked.dev)

A production-ready backend for an AI-powered Solana memecoin management system. Grok4 deploys memecoins on Pump.fun, monitors X community messages, and autonomously manages creator rewards, burns, buybacks, holder snapshots, and airdrops based on real-time market conditions.

## Features

- **Token Deployment** - Deploy memecoins on Pump.fun via PumpPortal API
- **Wallet Management** - Generate and manage Solana wallets using @solana/web3.js
- **Market Data** - Real-time marketcap, volume, and bonding curve progress from Pump.fun API
- **Creator Rewards** - Claim creator fees from Pump.fun trades
- **Token Burns** - Burn tokens to reduce supply
- **Buybacks** - Buy tokens from the market using treasury SOL
- **Holder Snapshots** - Take snapshots using Helius Pro API
- **Airdrops** - Distribute SOL or tokens to holders
- **Activity Logging** - Track all AI decisions and actions
- **Treasury Management** - Monitor SOL and token balances

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Blockchain:** Solana (@solana/web3.js, @solana/spl-token)
- **Validation:** Zod
- **ORM:** Drizzle ORM (PostgreSQL ready)
- **Language:** TypeScript

## API Endpoints

### Health & Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard` | Dashboard statistics |

### Wallet Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wallet/generate` | Generate new wallet |
| GET | `/api/wallet/treasury` | Get treasury wallet info |
| GET | `/api/wallet/:publicKey/balance` | Get wallet balances |

### Token Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/token/deploy` | Deploy new token on Pump.fun |
| GET | `/api/token/active` | Get active token |
| GET | `/api/token/:mint` | Get token by mint address |
| GET | `/api/token/:mint/market` | Get market data for token |
| GET | `/api/tokens` | List all tokens |

### Holder Snapshots

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/snapshot` | Take holder snapshot |
| GET | `/api/snapshot/:id` | Get snapshot by ID |
| GET | `/api/snapshots/:tokenMint` | Get snapshot history |

### Airdrop

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/airdrop` | Execute SOL or token airdrop |
| GET | `/api/airdrops` | List all airdrops |

### Burn & Buyback

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/burn` | Burn tokens |
| GET | `/api/burns` | List burn records |
| POST | `/api/buyback` | Execute token buyback |
| GET | `/api/buybacks` | List buyback records |

### Creator Rewards

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rewards/claim` | Claim creator rewards |
| GET | `/api/rewards/pending/:tokenMint` | Get pending rewards amount |
| GET | `/api/rewards` | List all reward claims |

### Activity Log

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activity` | Get all activity logs |
| GET | `/api/activity/:type` | Get logs by type |
| POST | `/api/activity/thought` | Log AI thought/decision |

### Treasury

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/treasury` | Get treasury status |
| POST | `/api/treasury/refresh` | Refresh treasury data |

## Environment Variables

```env
# Solana RPC (optional, defaults to mainnet)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Helius API for holder snapshots (required for snapshots)
HELIUS_API_KEY=your_helius_api_key

# Session secret for Express
SESSION_SECRET=your_session_secret
```

## External APIs Used

| API | Purpose | Documentation |
|-----|---------|---------------|
| PumpPortal | Token creation, trading, creator rewards | https://pumpportal.fun/creation |
| Pump.fun | Market data, token info | https://frontend-api-v3.pump.fun |
| Helius | Holder snapshots, RPC | https://helius.xyz |
| Solana Web3.js | Wallet, transfers, burns | https://solana-labs.github.io/solana-web3.js |

## Request Examples

### Deploy Token

```bash
curl -X POST http://localhost:5000/api/token/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grok4 Token",
    "symbol": "GROK4",
    "description": "Community-driven memecoin",
    "twitter": "https://twitter.com/groked",
    "website": "https://groked.dev",
    "initialBuyAmount": 0.1
  }'
```

### Take Holder Snapshot

```bash
curl -X POST http://localhost:5000/api/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "YOUR_TOKEN_MINT_ADDRESS"
  }'
```

### Execute Airdrop

```bash
curl -X POST http://localhost:5000/api/airdrop \
  -H "Content-Type: application/json" \
  -d '{
    "type": "token",
    "tokenMint": "YOUR_TOKEN_MINT_ADDRESS",
    "recipients": [
      {"wallet": "WALLET_ADDRESS_1", "amount": 100},
      {"wallet": "WALLET_ADDRESS_2", "amount": 200}
    ]
  }'
```

### Burn Tokens

```bash
curl -X POST http://localhost:5000/api/burn \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "YOUR_TOKEN_MINT_ADDRESS",
    "amount": 1000000,
    "reason": "Reducing supply based on community vote"
  }'
```

### Execute Buyback

```bash
curl -X POST http://localhost:5000/api/buyback \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "YOUR_TOKEN_MINT_ADDRESS",
    "solAmount": 1.5,
    "reason": "Market support during dip"
  }'
```

### Claim Creator Rewards

```bash
curl -X POST http://localhost:5000/api/rewards/claim \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "YOUR_TOKEN_MINT_ADDRESS"
  }'
```

### Log AI Thought

```bash
curl -X POST http://localhost:5000/api/activity/thought \
  -H "Content-Type: application/json" \
  -d '{
    "thought": "Market cap dropped 15%, initiating buyback to support price",
    "action": "buyback_decision",
    "metadata": {"marketCapChange": -15, "currentMcap": 50000}
  }'
```

## Project Structure

```
├── server/
│   ├── index.ts          # Express server entry
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Data storage interface
│   └── services/
│       ├── solana.ts     # Solana blockchain operations
│       └── pumpportal.ts # Pump.fun & PumpPortal API
├── shared/
│   └── schema.ts         # TypeScript types & Zod schemas
└── README.md
```

## Data Models

### Token
```typescript
interface Token {
  id: string;
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUri?: string;
  creatorWallet: string;
  bondingCurveAddress?: string;
  deployTxSignature?: string;
  status: "active" | "graduated" | "failed";
  createdAt: Date;
}
```

### ActivityLog
```typescript
interface ActivityLog {
  id: string;
  type: "deploy" | "burn" | "buyback" | "airdrop" | "claim_rewards" | "snapshot" | "thought";
  action: string;
  description?: string;
  thought?: string;        // AI reasoning
  txSignature?: string;
  amount?: string;
  tokenMint?: string;
  metadata?: object;
  status: "pending" | "success" | "failed";
  createdAt: Date;
}
```

### HolderSnapshot
```typescript
interface HolderSnapshot {
  id: string;
  tokenMint: string;
  snapshotData: Array<{wallet: string, balance: string, percentage: string}>;
  holderCount: number;
  totalSupplyHeld?: string;
  createdAt: Date;
}
```

## Getting Started

1. **Clone the repository**
```bash
git clone https://github.com/grokeddev/backend.git
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set environment variables**
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. **Run development server**
```bash
npm run dev
```

5. **Generate treasury wallet**
```bash
curl -X POST http://localhost:5000/api/wallet/generate \
  -H "Content-Type: application/json" \
  -d '{"type": "treasury", "label": "Main Treasury"}'
```

## Security Notes

- Private keys are stored encrypted (implement proper encryption in production)
- Never expose private keys in API responses
- Use environment variables for all secrets
- Implement rate limiting for production
- Add authentication for admin endpoints

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Built with love for the Solana community by [groked.dev](https://groked.dev)
