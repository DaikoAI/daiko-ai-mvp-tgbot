# DaikoAI MVP Telegram Bot

A Telegram bot built with Hono, LangGraph, and Drizzle ORM using Neon PostgreSQL database.

## Features

- 🤖 Telegram bot with webhook support
- 🗄️ PostgreSQL database with Drizzle ORM
- 🧠 LangGraph integration for AI workflows
- 🔗 Solana wallet integration
- 📊 User profile management and chat history
- 📈 OHLCV data collection and technical analysis
- 🔄 Automated data cleanup for optimal performance

## Agent Architectures

The system uses two main LangGraph agents with distinct workflows:

### Signal Agent

The Signal Agent processes technical analysis data to generate trading signals through a multi-stage pipeline:

![Signal Agent Graph](docs/signal-agent-graph.png)

**Workflow:**
1. **Static Filter** - Apply basic threshold filters to eliminate noise
2. **Data Fetch** - Retrieve additional market data and context
3. **LLM Analysis** - Advanced analysis using AI to evaluate signal quality
4. **Format Signal** - Convert analysis results into structured trading signals

The agent implements conditional routing where each stage can terminate the process early if conditions aren't met, ensuring only high-quality signals are generated.

### Telegram Agent

The Telegram Agent handles user interactions and provides conversational AI capabilities:

![Telegram Agent Graph](docs/telegram-agent-graph.png)

**Workflow:**
1. **Data Fetch** - Retrieve user profile and asset information
2. **Generalist** - Process user queries and generate appropriate responses

This streamlined architecture ensures responsive user interactions while maintaining access to user-specific data and market information.

### Generating Graph Images

To regenerate the agent graph visualizations:

```bash
bun run graphs:generate
```

This command will create updated PNG images in the `docs/` directory using Mermaid diagrams.

## Setup

### 1. Environment Variables

Create a `.env` file with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:port/database

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# OpenAI Configuration (for LangGraph)
OPENAI_API_KEY=your_openai_api_key_here

# Helius SDK Configuration (for Solana assets)
HELIUS_API_KEY=your_helius_api_key_here

# Vybe Network API Configuration (for OHLCV data)
VYBE_API_KEY=your_vybe_api_key_here

# Admin API Configuration
ADMIN_API_KEY=your_admin_api_key_here

# Development Environment
NODE_ENV=development
```

### 2. Database Setup

1. Create a Neon PostgreSQL database
2. Generate and run migrations:

```bash
bun install
bun run db:generate
bun run db:push
```

### 3. Telegram Bot Setup

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get your bot token and add it to `.env`
3. Set the webhook URL (after deployment):

```bash
# Using Telegram Bot API directly
curl "https://api.telegram.org/bot<token>/setWebhook?url=https://<domain>/webhook/telegram"

# Or using the internal webhook endpoint
curl -X POST https://your-domain.com/webhook/set \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/webhook/telegram"}'
```

## Development

```bash
bun install
bun run dev
```

## Testing

### Environment Setup for Tests

Before running tests, you need to set up environment variables. The project uses `.dev.vars` for development and `.env.test` for testing.

#### Option 1: Copy `.dev.vars` to `.env.test` (Recommended)

```bash
# Copy your development environment variables to test environment
cp .dev.vars .env.test
```

#### Option 2: Create `.env.test` manually

Create a `.env.test` file with the same variables as `.dev.vars`:

```bash
# Test Environment Variables
DATABASE_URL=postgresql://username:password@hostname:port/database_test
TELEGRAM_BOT_TOKEN=your_test_bot_token
OPENAI_API_KEY=your_openai_api_key
HELIUS_API_KEY=your_helius_api_key
VYBE_API_KEY=your_vybe_api_key
ADMIN_API_KEY=your_admin_api_key
CRON_SECRET=your_cron_secret
```

#### Option 3: Use dotenvx with `.dev.vars` (Current setup)

The current test scripts use `dotenvx` to load environment variables from `.dev.vars`:

```bash
# Test commands with dotenvx (already configured)
bun run test        # Uses dotenvx run -f .dev.vars -- bun test
bun run test:unit   # Uses dotenvx run -f .dev.vars -- bun test tests/unit
```

### Running Tests

```bash
# Run all tests
bun run test

# Run unit tests only
bun run test:unit

# Run integration tests only
bun run test:integration

# Run tests with coverage
bun run test:coverage
```

### Note on Test Environment

- Tests that require external APIs (OpenAI, Helius, Vybe) will fail if the corresponding API keys are not set
- Integration tests may require valid API credentials
- Unit tests focus on testing logic without external dependencies

## Turborepo Integration

このプロジェクトはTurborepoを使用してビルド、テスト、フォーマットのタスクを高速化しています。

### Main Commands (Turborepo対応)

```bash
# ビルド (キャッシュ対応)
bun run build

# テスト (キャッシュ対応、dotenvx使用)
bun run test
bun run test:unit
bun run test:integration
bun run test:coverage

# フォーマット (キャッシュ対応)
bun run format

# デプロイ (依存関係付き: build → test → deploy)
bun run deploy
```

### Cache Benefits

- **初回実行**: フルビルド・テスト実行
- **2回目以降**: ファイルが変更されていない場合はキャッシュから結果を取得
- **並列実行**: 複数のタスクを同時実行で高速化
- **依存関係管理**: タスク間の依存関係を自動管理
- **dotenvx統合**: テストコマンドで`.dev.vars`の環境変数が自動読み込み

### Internal Commands

実際に実行される元のコマンド（直接実行可能）:

```bash
# 直接実行 (キャッシュなし)
bun run _build         # tsup によるビルド
bun run _test          # dotenvx + vitest 全テスト
bun run _test:unit     # dotenvx + vitest ユニットテスト
bun run _test:coverage # dotenvx + vitest カバレッジテスト
bun run _test:integration # dotenvx + vitest インテグレーションテスト
bun run _format        # prettier フォーマット
bun run _deploy        # wrangler デプロイ
```

## Database Commands

```bash
# Generate migration files
bun run db:generate

# Push schema to database
bun run db:push

# Run migrations
bun run db:migrate

# Open Drizzle Studio
bun run db:studio
```

## OHLCV Data Management

The system automatically collects OHLCV (Open, High, Low, Close, Volume) data every 5 minutes for monitored tokens. To prevent database bloat, automated cleanup mechanisms are in place:

### Automated Cleanup

- **Frequency**: Every hour (when cron runs on the hour)
- **Retention Policy**: Keeps the latest 500 records per token (~1.7 days of 5-minute data)
- **Purpose**: Ensures optimal database performance while maintaining sufficient data for technical analysis

### Manual Cleanup via Admin API

You can manually trigger OHLCV data cleanup through the admin API:

#### Count-based Cleanup (Recommended)

```bash
curl -X POST https://your-domain.com/admin/cleanup-ohlcv \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: your_admin_api_key" \
  -d '{"method": "count", "keepCount": 500}'
```

#### Time-based Cleanup

```bash
curl -X POST https://your-domain.com/admin/cleanup-ohlcv \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: your_admin_api_key" \
  -d '{"method": "days", "retentionDays": 30}'
```

### Configuration

OHLCV data retention settings can be adjusted in `src/constants/database.ts`:

```typescript
export const OHLCV_RETENTION = {
  MAX_RECORDS_PER_TOKEN: 500, // Records to keep per token
  MIN_RECORDS_FOR_ANALYSIS: 50, // Minimum for technical analysis
  CLEANUP_INTERVAL_MINUTES: 60, // Cleanup frequency
} as const;
```

## Deployment

```bash
bun run deploy
```

## API Endpoints

### Core Endpoints

- `GET /` - Health check
- `GET /health` - Health status
- `POST /webhook/telegram` - Telegram webhook
- `POST /webhook/set` - Set webhook URL
- `GET /webhook/info` - Get webhook info

### Admin Endpoints

- `POST /admin/send-message` - Send message to specific user
- `POST /admin/broadcast` - Broadcast message to all users
- `POST /admin/cleanup-ohlcv` - Manual OHLCV data cleanup

## Database Schema

### Users Table

- `userId` (Primary Key) - Telegram user ID
- `walletAddress` - Solana wallet address
- `age` - User age
- `cryptoRiskTolerance` - Risk tolerance (1-10)
- `totalAssets` - Total assets value
- `cryptoAssets` - Crypto assets value
- `panicLevel` - Panic level (1-10)
- `heartRate` - Heart rate from wearables
- `interests` - JSON array of interests
- `currentSetupStep` - Current setup step
- `setupCompleted` - Setup completion status
- `waitingForInput` - Input waiting state
- `lastUpdated` - Last update timestamp
- `createdAt` - Creation timestamp

### Chat History Table

- `messageId` (Primary Key) - Message ID
- `userId` (Foreign Key) - Reference to users table
- `content` - Message content
- `messageType` - Message type ('human' or 'ai')
- `timestamp` - Message timestamp

### Token OHLCV Table

- `token` (Composite Primary Key) - Token address
- `timestamp` (Composite Primary Key) - UNIX timestamp
- `open` - Opening price
- `high` - Highest price
- `low` - Lowest price
- `close` - Closing price
- `volume` - Trading volume

**Performance Features:**

- Composite primary key on (token, timestamp) for efficient queries
- Descending index on timestamp for latest data retrieval
- Automated cleanup to maintain optimal size
- Batch upsert operations for high-throughput data ingestion

Chat history is now persisted in the Neon database, allowing conversations to continue across bot restarts. Users can clear their chat history using the `/clear` command.

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
bun run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

## Code Review

This project uses [CodeRabbit](https://coderabbit.ai) for AI-powered code reviews. The configuration is optimized for this TypeScript Telegram bot project with specific focus on:

- Security (API keys, input validation, Solana wallet handling)
- Performance (Cloudflare Workers optimization, database efficiency)
- Architecture (LangGraph patterns, error handling)
- Integration robustness (webhooks, external APIs)

See [docs/coderabbit-setup.md](docs/coderabbit-setup.md) for detailed setup and usage instructions.
