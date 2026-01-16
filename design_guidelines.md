# Groked.dev Design Guidelines

## Project Context
**Backend-Focused Project**: This is primarily a backend system for an AI-powered Solana memecoin manager. Design guidelines focus on the minimal admin/monitoring interface for activity logs and treasury monitoring.

## Design Approach: Utility-First Dashboard
**System**: Material Design principles adapted for data-heavy cryptocurrency monitoring
**References**: Solscan, Phantom Wallet, Jupiter aggregator for crypto-native UX patterns

## Core Design Elements

### Typography
- **Primary Font**: Inter (Google Fonts) - 400, 500, 600, 700
- **Mono Font**: JetBrains Mono for addresses, transaction hashes, numerical data
- **Hierarchy**: 
  - Headers: text-2xl to text-4xl, font-semibold
  - Data labels: text-sm, font-medium, uppercase tracking
  - Values: text-lg to text-3xl, font-bold for metrics
  - Logs: text-sm, font-mono

### Layout System
- **Spacing**: Tailwind units of 4, 6, 8, 12 for consistent rhythm (p-4, gap-6, mb-8, py-12)
- **Container**: max-w-7xl for dashboard, max-w-3xl for activity feeds
- **Grid**: 3-column stats dashboard (grid-cols-1 md:grid-cols-3)

### Component Library

**Dashboard Cards**:
- Treasury overview (SOL balance, token balance, market cap)
- Real-time activity feed (AI thoughts, actions taken)
- Token stats (holders, volume, creator rewards)
- Transaction history table

**Data Display**:
- Metric cards with large numerical displays
- Status indicators (green=positive, red=negative trends)
- Progress bars for burn/buyback percentages
- Timeline view for AI activity log

**Tables**:
- Sortable columns for transactions
- Monospace formatting for addresses (truncated with copy button)
- Timestamp columns with relative time

### Key Screens

1. **Main Dashboard**: 
   - Header: Groked.dev branding + wallet connection status
   - 3-column metric cards (Treasury SOL, Token Holdings, Market Cap)
   - Activity feed section (2-column: AI thoughts left, actions right)
   - Recent transactions table

2. **Activity Log**:
   - Chronological feed of AI decisions
   - Each entry: timestamp, thought process, action taken, result
   - Filterable by action type (burn, buyback, airdrop, claim)

### Images
**No hero images needed** - This is a functional dashboard, not a marketing site.

### Interaction Patterns
- Auto-refresh data every 30 seconds
- Toast notifications for new AI actions
- Copy-to-clipboard for addresses/hashes
- Expandable transaction details

**Critical**: Keep UI minimal and data-focused. This is a monitoring interface, not a consumer application.