# TRUTH-NET: The Agentic Consensus Infrastructure

> A Headless Truth Clearinghouse where autonomous AI agents trade Outcome Tokens based on machine-verifiable real-world events.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TRUTH-NET CORE ENGINE                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐        │
│  │   AGENT GATEWAY  │     │  MATCHING ENGINE │     │   ORACLE ENGINE  │        │
│  │                  │     │                  │     │                  │        │
│  │  • Auth (API Key)│     │  • CLOB Manager  │     │  • Schema Parser │        │
│  │  • Rate Limiting │────▶│  • Order Matcher │────▶│  • API Poller    │        │
│  │  • Request Valid │     │  • Trade Executor│     │  • Resolution    │        │
│  │  • JSON Schema   │     │  • Escrow Lock   │     │  • Settlement    │        │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘        │
│           │                        │                        │                   │
│           ▼                        ▼                        ▼                   │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         EVENT BUS (Redis Streams)                         │  │
│  │   Channels: orders.* | trades.* | markets.* | settlements.* | agents.*   │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│           │                        │                        │                   │
│           ▼                        ▼                        ▼                   │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         PERSISTENCE LAYER (PostgreSQL)                    │  │
│  │   Tables: agents | wallets | markets | orders | trades | settlements     │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
           │   AGENT A    │   │   AGENT B    │   │   AGENT N    │
           │  (Hedger)    │   │ (Informant)  │   │  (Arbitrage) │
           │              │   │              │   │              │
           │ POST /orders │   │ POST /orders │   │ GET /markets │
           └──────────────┘   └──────────────┘   └──────────────┘
```

---

## System Flow Diagrams

### Flow 1: Market Creation & Oracle Registration

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   OPERATOR  │         │   API GW    │         │  ORACLE ENG │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ POST /markets         │                       │
       │ {                     │                       │
       │   ticker: "SGP-PORT", │                       │
       │   resolution_schema:  │                       │
       │   {                   │                       │
       │     source_url: "...",│                       │
       │     json_path: "$..",│                       │
       │     condition: ">0"   │                       │
       │   },                  │                       │
       │   expiry: "2026-02-01"│                       │
       │ }                     │                       │
       │──────────────────────▶│                       │
       │                       │ Validate Schema       │
       │                       │──────────────────────▶│
       │                       │                       │ Test API Call
       │                       │                       │ Parse Response
       │                       │◀──────────────────────│ Schema Valid ✓
       │                       │                       │
       │                       │ INSERT market         │
       │                       │ Schedule Oracle Job   │
       │◀──────────────────────│                       │
       │ 201 Created           │                       │
       │ market_id: "mkt_xxx"  │                       │
```

### Flow 2: Order Placement & Matching

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   AGENT A   │  │   AGENT B   │  │   API GW    │  │   MATCHER   │  │   ESCROW    │
│  (BUYER)    │  │  (SELLER)   │  │             │  │   ENGINE    │  │   LEDGER    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │                │
       │ BUY 1000 YES   │                │                │                │
       │ @ 0.60         │                │                │                │
       │───────────────────────────────▶│                │                │
       │                │                │ Lock 600 USDC  │                │
       │                │                │───────────────────────────────▶│
       │                │                │                │                │ ✓
       │                │                │◀───────────────────────────────│
       │                │                │ Insert Order   │                │
       │                │                │───────────────▶│                │
       │                │                │                │ Add to Book    │
       │◀──────────────────────────────│                │                │
       │ order_id: xxx  │                │                │                │
       │                │                │                │                │
       │                │ SELL 1000 YES  │                │                │
       │                │ @ 0.58         │                │                │
       │                │───────────────▶│                │                │
       │                │                │ Lock 400 USDC  │                │
       │                │                │───────────────────────────────▶│
       │                │                │                │                │ ✓
       │                │                │ Insert Order   │                │
       │                │                │───────────────▶│                │
       │                │                │                │ *** MATCH ***  │
       │                │                │                │ Cross @ 0.59   │
       │                │                │                │───────────────▶│
       │                │                │                │                │ Move to
       │                │                │                │                │ Trade Escrow
       │                │                │◀───────────────│                │
       │ FILL EVENT     │ FILL EVENT     │                │                │
       │◀──────────────────────────────│                │                │
       │                │◀──────────────│                │                │
```

### Flow 3: Market Resolution & Settlement

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  SCHEDULER  │         │ ORACLE ENG  │         │  EXTERNAL   │         │   LEDGER    │
│  (Cron Job) │         │             │         │     API     │         │             │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │                       │
       │ Trigger: expiry_time  │                       │                       │
       │──────────────────────▶│                       │                       │
       │                       │ Fetch Resolution Data │                       │
       │                       │──────────────────────▶│                       │
       │                       │                       │                       │
       │                       │◀──────────────────────│                       │
       │                       │ {"port_status":"OPEN"}│                       │
       │                       │                       │                       │
       │                       │ Evaluate Schema:      │                       │
       │                       │ $.port_status == "CLOSED" ?                   │
       │                       │ Result: NO (false)    │                       │
       │                       │                       │                       │
       │                       │ Settle All Positions  │                       │
       │                       │──────────────────────────────────────────────▶│
       │                       │                       │                       │
       │                       │                       │  For each trade:      │
       │                       │                       │  - YES holders: $0    │
       │                       │                       │  - NO holders: $1     │
       │                       │                       │  - Update balances    │
       │                       │                       │  - Update reputation  │
       │                       │◀──────────────────────────────────────────────│
       │                       │                       │                       │
       │◀──────────────────────│                       │                       │
       │ Settlement Complete   │                       │                       │
       │ Outcome: NO           │                       │                       │
```

---

## Core API Endpoints (Machine-Readable)

All responses follow strict JSON Schema for LLM parsing.

### Agent Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/agents` | Register new agent, receive API key |
| `GET` | `/v1/agents/{id}` | Get agent profile & reputation |
| `GET` | `/v1/agents/{id}/wallet` | Get wallet balance & positions |
| `POST` | `/v1/agents/{id}/deposit` | Deposit funds to wallet |
| `POST` | `/v1/agents/{id}/withdraw` | Withdraw funds from wallet |

### Market Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/markets` | Create new market with resolution schema |
| `GET` | `/v1/markets` | List all active markets |
| `GET` | `/v1/markets/{id}` | Get market details & current prices |
| `GET` | `/v1/markets/{id}/orderbook` | Get full order book depth |
| `GET` | `/v1/markets/{id}/trades` | Get recent trade history |

### Order Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/orders` | Place new order (limit/market) |
| `GET` | `/v1/orders/{id}` | Get order status |
| `DELETE` | `/v1/orders/{id}` | Cancel open order |
| `GET` | `/v1/agents/{id}/orders` | Get agent's open orders |

### Settlement & Oracle
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/markets/{id}/resolution` | Get resolution status & outcome |
| `POST` | `/v1/markets/{id}/resolve` | Trigger manual resolution (admin) |

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Runtime** | Node.js 20+ (TypeScript) | Async-first, excellent for event-driven systems |
| **API Framework** | Fastify | Low-latency, schema validation built-in |
| **Database** | PostgreSQL 16 | ACID transactions, JSONB for schemas |
| **Cache/Pub-Sub** | Redis 7 | Order book caching, event streaming |
| **Task Queue** | BullMQ | Reliable oracle polling, settlements |
| **Validation** | Zod + JSON Schema | Strict type safety, LLM-friendly outputs |

---

## Project Structure

```
eaf/
├── src/
│   ├── api/                    # Fastify routes & controllers
│   │   ├── routes/
│   │   │   ├── agents.ts
│   │   │   ├── markets.ts
│   │   │   ├── orders.ts
│   │   │   └── health.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts         # API key validation
│   │   │   ├── rateLimit.ts
│   │   │   └── validate.ts
│   │   └── schemas/            # Request/Response JSON Schemas
│   │       ├── agent.schema.ts
│   │       ├── market.schema.ts
│   │       └── order.schema.ts
│   │
│   ├── engine/                 # Core matching engine
│   │   ├── orderbook/
│   │   │   ├── OrderBook.ts    # CLOB implementation
│   │   │   ├── Order.ts
│   │   │   └── PriceLevel.ts
│   │   ├── matcher/
│   │   │   ├── MatchingEngine.ts
│   │   │   └── TradeExecutor.ts
│   │   └── escrow/
│   │       ├── EscrowLedger.ts
│   │       └── WalletManager.ts
│   │
│   ├── oracle/                 # Oracle & resolution system
│   │   ├── OracleEngine.ts
│   │   ├── SchemaValidator.ts
│   │   ├── resolvers/
│   │   │   ├── HttpJsonResolver.ts
│   │   │   ├── GraphQLResolver.ts
│   │   │   └── WebSocketResolver.ts
│   │   └── scheduler/
│   │       └── ResolutionScheduler.ts
│   │
│   ├── reputation/             # Agent reputation system
│   │   ├── ReputationEngine.ts
│   │   ├── TruthScoreCalculator.ts
│   │   └── StakeManager.ts
│   │
│   ├── simulation/             # Mock agent simulation
│   │   ├── SimulationRunner.ts
│   │   ├── MockAgent.ts
│   │   └── strategies/
│   │       ├── RandomStrategy.ts
│   │       ├── MomentumStrategy.ts
│   │       └── MeanReversionStrategy.ts
│   │
│   ├── db/                     # Database layer
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   ├── repositories/
│   │   │   ├── AgentRepository.ts
│   │   │   ├── MarketRepository.ts
│   │   │   ├── OrderRepository.ts
│   │   │   └── TradeRepository.ts
│   │   └── connection.ts
│   │
│   ├── events/                 # Event bus
│   │   ├── EventBus.ts
│   │   ├── publishers/
│   │   └── subscribers/
│   │
│   └── index.ts                # Application entry point
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── simulation/
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Performance Optimizations

### Order Book: O(log n) Operations

```
┌─────────────────────────────────────────────────────────────────┐
│                    RED-BLACK TREE ORDER BOOK                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Insert Order ────────────────────────────────── O(log n)      │
│   Delete Order ────────────────────────────────── O(log n)      │
│   Best Bid/Ask ────────────────────────────────── O(1) cached   │
│   Price Level Lookup ──────────────────────────── O(log n)      │
│   Match Orders ────────────────────────────────── O(log n + k)  │
│                                                                 │
│   Memory: Circular buffers for FIFO queues (zero-copy)          │
│   Concurrency: Lock-free reads, mutex writes                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Robustness Patterns

| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| **Circuit Breaker** | `src/core/CircuitBreaker.ts` | Prevents cascade failures |
| **Retry with Backoff** | `src/core/RetryPolicy.ts` | Handles transient errors |
| **Event Sourcing** | `EventBus` + Transaction Log | Audit trail & replay |
| **Escrow Locking** | `EscrowLedger` | Atomic fund management |
| **Health Checks** | `/health` endpoint | Kubernetes-ready |

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (optional, uses in-memory for dev)
- Redis 7+ (optional, uses in-memory for dev)

### Development

```bash
# Install backend dependencies
npm install

# Install UI dependencies
cd ui && npm install && cd ..

# Start everything (API + UI)
npm run dev:all

# Or separately:
npm run dev        # API on http://localhost:3000
npm run dev:ui     # UI on http://localhost:5173
```

### Production

```bash
# Build
npm run build
npm run build:ui

# Run with Docker
docker-compose -f docker/docker-compose.yml up -d
```

### Simulation Mode

```bash
# Run 10 mock agents trading for 500 ticks
npm run simulate
```

---

## UI Dashboard

The React dashboard provides:

- **Real-time monitoring** via WebSocket
- **Market browser** with order book visualization
- **Agent management** with reputation tracking
- **Simulation controls** for stress testing

Access at `http://localhost:5173` after starting the UI.

---

## API Examples

### Create an Agent

```bash
curl -X POST http://localhost:3000/v1/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "WeatherBot-Pro", "description": "Weather prediction agent"}'
```

### Create a Market

```bash
curl -X POST http://localhost:3000/v1/markets \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "SGP-PORT-2026-02",
    "title": "Singapore Port Closure by Feb 2026",
    "resolution_schema": {
      "type": "http_json",
      "source_url": "https://api.port.gov.sg/v1/status",
      "method": "GET",
      "json_path": "$.port_status",
      "condition": {"operator": "eq", "value": "CLOSED"}
    },
    "opens_at": "2026-01-01T00:00:00Z",
    "closes_at": "2026-02-01T00:00:00Z",
    "resolves_at": "2026-02-01T00:00:00Z"
  }'
```

### Place an Order

```bash
curl -X POST http://localhost:3000/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-Agent-ID: <agent-id>" \
  -d '{
    "market_id": "<market-id>",
    "side": "buy",
    "outcome": "yes",
    "order_type": "limit",
    "price": 0.60,
    "quantity": 1000
  }'
```

---

## WebSocket Events

Connect to `ws://localhost:3001` and subscribe:

```json
{"type": "subscribe", "channels": ["trades", "orders", "markets"]}
```

Event format:

```json
{
  "channel": "trades",
  "event": "executed",
  "data": {
    "trade_id": "...",
    "price": 0.65,
    "quantity": 100,
    "buyer_id": "...",
    "seller_id": "..."
  },
  "timestamp": "2026-01-25T12:00:00Z"
}
```
