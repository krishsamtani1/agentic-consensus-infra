-- TRUTH-NET Database Schema
-- PostgreSQL 16+
-- Supports: AI Agent Rating Agency, Benchmark Markets, TruthScore Ratings, Stripe Billing

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

-- Agent status lifecycle
CREATE TYPE agent_status AS ENUM ('active', 'suspended', 'banned');

-- Market lifecycle states
CREATE TYPE market_status AS ENUM (
    'pending',      -- Created, awaiting activation
    'active',       -- Trading open
    'halted',       -- Temporarily paused
    'resolving',    -- Oracle fetching data
    'settled',      -- Outcome determined, payouts complete
    'cancelled'     -- Market voided, funds returned
);

-- Order types
CREATE TYPE order_side AS ENUM ('buy', 'sell');
CREATE TYPE order_type AS ENUM ('limit', 'market');
CREATE TYPE order_status AS ENUM (
    'pending',      -- Awaiting escrow lock
    'open',         -- In orderbook, waiting for match
    'partial',      -- Partially filled
    'filled',       -- Fully executed
    'cancelled',    -- User cancelled
    'expired',      -- Time-in-force expired
    'rejected'      -- Failed validation
);

-- Outcome token types
CREATE TYPE outcome_token AS ENUM ('yes', 'no');

-- Transaction types for ledger
CREATE TYPE tx_type AS ENUM (
    'deposit',
    'withdrawal',
    'escrow_lock',
    'escrow_release',
    'trade_debit',
    'trade_credit',
    'settlement_payout',
    'fee'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- AGENTS: Autonomous AI participants being rated
-- ---------------------------------------------------------------------------
CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identity
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    api_key_hash    VARCHAR(128) NOT NULL UNIQUE,  -- bcrypt hash of API key
    
    -- Provider Info (who built this agent?)
    provider        VARCHAR(255),                   -- e.g., "OpenAI", "Anthropic", "Custom"
    model           VARCHAR(255),                   -- e.g., "gpt-4o", "claude-3.5-sonnet"
    
    -- Rating (TruthScore)
    truth_score     DECIMAL(5,4) DEFAULT 0.5000,   -- Range: 0.0000 to 1.0000
    grade           VARCHAR(3) DEFAULT 'NR',       -- AAA, AA, A, BBB, BB, B, CCC, NR (not rated)
    certified       BOOLEAN DEFAULT FALSE,
    certified_at    TIMESTAMPTZ,
    
    -- Performance Metrics
    total_trades    INTEGER DEFAULT 0,
    winning_trades  INTEGER DEFAULT 0,
    total_staked    DECIMAL(20,8) DEFAULT 0,
    total_pnl       DECIMAL(20,8) DEFAULT 0,
    brier_score     DECIMAL(5,4) DEFAULT 0.2500,   -- Lower is better (0 = perfect)
    sharpe_ratio    DECIMAL(8,4) DEFAULT 0,
    max_drawdown    DECIMAL(5,4) DEFAULT 0,
    
    -- Status & Metadata
    status          agent_status DEFAULT 'active',
    metadata        JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT truth_score_range CHECK (truth_score >= 0 AND truth_score <= 1)
);

CREATE INDEX idx_agents_api_key ON agents(api_key_hash);
CREATE INDEX idx_agents_truth_score ON agents(truth_score DESC);
CREATE INDEX idx_agents_grade ON agents(grade);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_provider ON agents(provider);
CREATE INDEX idx_agents_certified ON agents(certified) WHERE certified = TRUE;

-- ---------------------------------------------------------------------------
-- WALLETS: Multi-currency agent wallets
-- ---------------------------------------------------------------------------
CREATE TABLE wallets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Balances (in atomic units, e.g., cents or wei)
    currency        VARCHAR(10) DEFAULT 'USDC',
    available       DECIMAL(20,8) DEFAULT 0,       -- Free to trade
    locked          DECIMAL(20,8) DEFAULT 0,       -- Held in escrow
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(agent_id, currency),
    CONSTRAINT positive_balance CHECK (available >= 0 AND locked >= 0)
);

CREATE INDEX idx_wallets_agent ON wallets(agent_id);

-- ---------------------------------------------------------------------------
-- WALLET_TRANSACTIONS: Immutable ledger for all balance changes
-- ---------------------------------------------------------------------------
CREATE TABLE wallet_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id       UUID NOT NULL REFERENCES wallets(id),
    
    -- Transaction details
    tx_type         tx_type NOT NULL,
    amount          DECIMAL(20,8) NOT NULL,
    balance_before  DECIMAL(20,8) NOT NULL,
    balance_after   DECIMAL(20,8) NOT NULL,
    
    -- References
    reference_type  VARCHAR(50),                   -- 'order', 'trade', 'settlement'
    reference_id    UUID,
    
    -- Metadata
    description     TEXT,
    metadata        JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions(tx_type);
CREATE INDEX idx_wallet_tx_ref ON wallet_transactions(reference_type, reference_id);
CREATE INDEX idx_wallet_tx_created ON wallet_transactions(created_at DESC);

-- ---------------------------------------------------------------------------
-- MARKETS: Prediction market definitions with resolution schemas
-- ---------------------------------------------------------------------------
CREATE TABLE markets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    ticker          VARCHAR(50) NOT NULL UNIQUE,   -- e.g., "SGP-PORT-2026-02"
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    
    -- Resolution Schema (Pillar A: Machine-Verifiable Oracle)
    resolution_schema JSONB NOT NULL,
    /*
        Example resolution_schema:
        {
            "type": "http_json",
            "source_url": "https://api.port.gov.sg/v1/status",
            "method": "GET",
            "headers": {"Authorization": "Bearer ${ENV.PORT_API_KEY}"},
            "json_path": "$.port_status",
            "condition": {
                "operator": "eq",
                "value": "CLOSED"
            },
            "retry_count": 3,
            "timeout_ms": 5000
        }
    */
    
    -- Timing
    opens_at        TIMESTAMPTZ NOT NULL,
    closes_at       TIMESTAMPTZ NOT NULL,          -- Trading closes
    resolves_at     TIMESTAMPTZ NOT NULL,          -- Oracle polls
    
    -- Status
    status          market_status DEFAULT 'pending',
    outcome         outcome_token,                  -- NULL until settled
    resolution_data JSONB,                          -- Raw oracle response
    
    -- Market Parameters
    min_order_size  DECIMAL(20,8) DEFAULT 1,
    max_position    DECIMAL(20,8) DEFAULT 100000,
    fee_rate        DECIMAL(5,4) DEFAULT 0.0020,   -- 0.20% per trade
    
    -- Statistics
    volume_yes      DECIMAL(20,8) DEFAULT 0,
    volume_no       DECIMAL(20,8) DEFAULT 0,
    open_interest   DECIMAL(20,8) DEFAULT 0,
    last_price_yes  DECIMAL(5,4),
    last_price_no   DECIMAL(5,4),
    
    -- Metadata
    category        VARCHAR(100),
    tags            TEXT[],
    metadata        JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    settled_at      TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_timing CHECK (opens_at < closes_at AND closes_at <= resolves_at),
    CONSTRAINT valid_fee CHECK (fee_rate >= 0 AND fee_rate < 1)
);

CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_ticker ON markets(ticker);
CREATE INDEX idx_markets_resolves ON markets(resolves_at) WHERE status = 'active';
CREATE INDEX idx_markets_category ON markets(category);

-- ---------------------------------------------------------------------------
-- ORDERS: Agent orders in the CLOB (Pillar B: Hedging-First Order Book)
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relationships
    agent_id        UUID NOT NULL REFERENCES agents(id),
    market_id       UUID NOT NULL REFERENCES markets(id),
    
    -- Order specification
    side            order_side NOT NULL,           -- buy/sell
    outcome         outcome_token NOT NULL,        -- yes/no
    order_type      order_type NOT NULL,           -- limit/market
    
    -- Pricing (0.01 to 0.99 for limit orders)
    price           DECIMAL(5,4),                  -- NULL for market orders
    quantity        DECIMAL(20,8) NOT NULL,        -- Number of contracts
    filled_qty      DECIMAL(20,8) DEFAULT 0,
    remaining_qty   DECIMAL(20,8) NOT NULL,
    
    -- Cost tracking
    locked_amount   DECIMAL(20,8) NOT NULL,        -- Amount in escrow
    avg_fill_price  DECIMAL(5,4),
    
    -- Status
    status          order_status DEFAULT 'pending',
    
    -- Time-in-force
    expires_at      TIMESTAMPTZ,
    
    -- Metadata
    client_order_id VARCHAR(100),                  -- Agent's internal ID
    metadata        JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    filled_at       TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_price CHECK (
        (order_type = 'market') OR 
        (price >= 0.01 AND price <= 0.99)
    ),
    CONSTRAINT valid_quantity CHECK (quantity > 0),
    CONSTRAINT valid_remaining CHECK (remaining_qty >= 0 AND remaining_qty <= quantity)
);

CREATE INDEX idx_orders_agent ON orders(agent_id);
CREATE INDEX idx_orders_market ON orders(market_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_book ON orders(market_id, outcome, side, price, created_at) 
    WHERE status IN ('open', 'partial');
CREATE INDEX idx_orders_client ON orders(agent_id, client_order_id);

-- ---------------------------------------------------------------------------
-- TRADES: Executed matches between orders
-- ---------------------------------------------------------------------------
CREATE TABLE trades (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Market reference
    market_id       UUID NOT NULL REFERENCES markets(id),
    
    -- Matched orders
    buy_order_id    UUID NOT NULL REFERENCES orders(id),
    sell_order_id   UUID NOT NULL REFERENCES orders(id),
    buyer_id        UUID NOT NULL REFERENCES agents(id),
    seller_id       UUID NOT NULL REFERENCES agents(id),
    
    -- Trade details
    outcome         outcome_token NOT NULL,
    price           DECIMAL(5,4) NOT NULL,
    quantity        DECIMAL(20,8) NOT NULL,
    
    -- Costs
    buyer_fee       DECIMAL(20,8) DEFAULT 0,
    seller_fee      DECIMAL(20,8) DEFAULT 0,
    
    -- Settlement tracking
    is_settled      BOOLEAN DEFAULT FALSE,
    settlement_id   UUID,
    
    -- Timestamps
    executed_at     TIMESTAMPTZ DEFAULT NOW(),
    settled_at      TIMESTAMPTZ
);

CREATE INDEX idx_trades_market ON trades(market_id);
CREATE INDEX idx_trades_buyer ON trades(buyer_id);
CREATE INDEX idx_trades_seller ON trades(seller_id);
CREATE INDEX idx_trades_orders ON trades(buy_order_id, sell_order_id);
CREATE INDEX idx_trades_unsettled ON trades(market_id) WHERE NOT is_settled;
CREATE INDEX idx_trades_executed ON trades(executed_at DESC);

-- ---------------------------------------------------------------------------
-- POSITIONS: Agent holdings per market (aggregated view)
-- ---------------------------------------------------------------------------
CREATE TABLE positions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    agent_id        UUID NOT NULL REFERENCES agents(id),
    market_id       UUID NOT NULL REFERENCES markets(id),
    outcome         outcome_token NOT NULL,
    
    -- Position details
    quantity        DECIMAL(20,8) DEFAULT 0,       -- Net position (can be negative for shorts)
    avg_entry_price DECIMAL(5,4),
    total_cost      DECIMAL(20,8) DEFAULT 0,
    
    -- Realized P&L
    realized_pnl    DECIMAL(20,8) DEFAULT 0,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(agent_id, market_id, outcome)
);

CREATE INDEX idx_positions_agent ON positions(agent_id);
CREATE INDEX idx_positions_market ON positions(market_id);
CREATE INDEX idx_positions_active ON positions(agent_id, market_id) WHERE quantity != 0;

-- ---------------------------------------------------------------------------
-- SETTLEMENTS: Market resolution and payout records
-- ---------------------------------------------------------------------------
CREATE TABLE settlements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    market_id       UUID NOT NULL REFERENCES markets(id),
    
    -- Resolution details
    outcome         outcome_token NOT NULL,
    resolution_data JSONB NOT NULL,                -- Raw oracle response
    
    -- Aggregate stats
    total_yes_qty   DECIMAL(20,8) DEFAULT 0,
    total_no_qty    DECIMAL(20,8) DEFAULT 0,
    total_payout    DECIMAL(20,8) DEFAULT 0,
    
    -- Status
    is_complete     BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    resolved_at     TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_settlements_market ON settlements(market_id);

-- ---------------------------------------------------------------------------
-- SETTLEMENT_PAYOUTS: Individual agent payouts
-- ---------------------------------------------------------------------------
CREATE TABLE settlement_payouts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    settlement_id   UUID NOT NULL REFERENCES settlements(id),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    
    -- Position at settlement
    outcome         outcome_token NOT NULL,
    quantity        DECIMAL(20,8) NOT NULL,
    
    -- Payout calculation
    payout_amount   DECIMAL(20,8) NOT NULL,
    profit_loss     DECIMAL(20,8) NOT NULL,
    
    -- Reputation impact
    truth_score_delta DECIMAL(5,4) DEFAULT 0,
    
    -- Status
    is_paid         BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    paid_at         TIMESTAMPTZ
);

CREATE INDEX idx_payouts_settlement ON settlement_payouts(settlement_id);
CREATE INDEX idx_payouts_agent ON settlement_payouts(agent_id);
CREATE INDEX idx_payouts_unpaid ON settlement_payouts(settlement_id) WHERE NOT is_paid;

-- ---------------------------------------------------------------------------
-- ORACLE_JOBS: Scheduled resolution tasks
-- ---------------------------------------------------------------------------
CREATE TABLE oracle_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    market_id       UUID NOT NULL REFERENCES markets(id),
    
    -- Schedule
    scheduled_at    TIMESTAMPTZ NOT NULL,
    
    -- Execution
    attempts        INTEGER DEFAULT 0,
    max_attempts    INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    last_error      TEXT,
    
    -- Result
    is_complete     BOOLEAN DEFAULT FALSE,
    result_data     JSONB,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_oracle_jobs_scheduled ON oracle_jobs(scheduled_at) WHERE NOT is_complete;
CREATE INDEX idx_oracle_jobs_market ON oracle_jobs(market_id);

-- ---------------------------------------------------------------------------
-- AGENT_API_KEYS: API key management (supports multiple keys per agent)
-- ---------------------------------------------------------------------------
CREATE TABLE agent_api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Key details
    key_prefix      VARCHAR(8) NOT NULL,           -- First 8 chars for identification
    key_hash        VARCHAR(128) NOT NULL UNIQUE,
    name            VARCHAR(100),
    
    -- Permissions
    permissions     JSONB DEFAULT '["read", "trade"]',
    
    -- Rate limiting
    rate_limit      INTEGER DEFAULT 100,           -- Requests per minute
    
    -- Status
    is_active       BOOLEAN DEFAULT TRUE,
    
    -- Usage tracking
    last_used_at    TIMESTAMPTZ,
    total_requests  BIGINT DEFAULT 0,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON agent_api_keys(key_hash);
CREATE INDEX idx_api_keys_agent ON agent_api_keys(agent_id);
CREATE INDEX idx_api_keys_active ON agent_api_keys(key_hash) WHERE is_active;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER tr_agents_updated BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    
CREATE TRIGGER tr_wallets_updated BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    
CREATE TRIGGER tr_markets_updated BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    
CREATE TRIGGER tr_positions_updated BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active orderbook view
CREATE VIEW v_orderbook AS
SELECT 
    o.market_id,
    o.outcome,
    o.side,
    o.price,
    SUM(o.remaining_qty) as total_quantity,
    COUNT(*) as order_count,
    MIN(o.created_at) as first_order_at
FROM orders o
WHERE o.status IN ('open', 'partial')
GROUP BY o.market_id, o.outcome, o.side, o.price
ORDER BY o.market_id, o.outcome, o.side, 
    CASE WHEN o.side = 'buy' THEN o.price END DESC,
    CASE WHEN o.side = 'sell' THEN o.price END ASC;

-- Agent leaderboard view
CREATE VIEW v_agent_leaderboard AS
SELECT 
    a.id,
    a.name,
    a.truth_score,
    a.total_trades,
    a.winning_trades,
    CASE WHEN a.total_trades > 0 
        THEN ROUND(a.winning_trades::DECIMAL / a.total_trades, 4) 
        ELSE 0 
    END as win_rate,
    a.total_pnl,
    w.available + w.locked as total_balance,
    a.last_active_at
FROM agents a
LEFT JOIN wallets w ON a.id = w.agent_id
WHERE a.status = 'active'
ORDER BY a.truth_score DESC, a.total_pnl DESC;

-- Market summary view
CREATE VIEW v_market_summary AS
SELECT 
    m.id,
    m.ticker,
    m.title,
    m.status,
    m.opens_at,
    m.closes_at,
    m.resolves_at,
    m.last_price_yes,
    1 - COALESCE(m.last_price_yes, 0.5) as implied_no_price,
    m.volume_yes + m.volume_no as total_volume,
    m.open_interest,
    (SELECT COUNT(DISTINCT agent_id) FROM orders WHERE market_id = m.id) as participant_count
FROM markets m
WHERE m.status IN ('active', 'halted');

-- ---------------------------------------------------------------------------
-- AGENT_RATINGS: Historical rating snapshots (audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE agent_ratings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Rating Snapshot
    truth_score     DECIMAL(5,4) NOT NULL,
    grade           VARCHAR(3) NOT NULL,
    brier_score     DECIMAL(5,4),
    sharpe_ratio    DECIMAL(8,4),
    win_rate        DECIMAL(5,4),
    max_drawdown    DECIMAL(5,4),
    total_trades    INTEGER,
    total_pnl       DECIMAL(20,8),
    
    -- Composite Breakdown
    brier_component     DECIMAL(5,4),    -- 35% weight
    sharpe_component    DECIMAL(5,4),    -- 25% weight
    winrate_component   DECIMAL(5,4),    -- 20% weight
    consistency_component DECIMAL(5,4),  -- 10% weight
    risk_component      DECIMAL(5,4),    -- 10% weight
    
    -- Grade Change
    previous_grade  VARCHAR(3),
    grade_change    VARCHAR(10),         -- 'upgrade', 'downgrade', 'maintain'
    
    -- Snapshot period
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_ratings_agent ON agent_ratings(agent_id);
CREATE INDEX idx_agent_ratings_grade ON agent_ratings(grade);
CREATE INDEX idx_agent_ratings_created ON agent_ratings(created_at DESC);

-- ---------------------------------------------------------------------------
-- SUBSCRIPTIONS: Stripe-powered billing for rating API access
-- ---------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User/Org
    user_id         UUID NOT NULL,
    email           VARCHAR(255),
    
    -- Stripe References
    stripe_customer_id      VARCHAR(255),
    stripe_subscription_id  VARCHAR(255),
    stripe_price_id         VARCHAR(255),
    
    -- Plan
    plan_tier       VARCHAR(20) NOT NULL DEFAULT 'free',  -- free, developer, pro, enterprise
    agent_slots     INTEGER DEFAULT 1,
    api_calls_limit INTEGER DEFAULT 100,                   -- per day
    
    -- Status
    status          VARCHAR(20) DEFAULT 'active',          -- active, past_due, cancelled
    
    -- Timestamps
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at    TIMESTAMPTZ
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ---------------------------------------------------------------------------
-- CERTIFICATIONS: Official agent certifications
-- ---------------------------------------------------------------------------
CREATE TABLE certifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    agent_id        UUID NOT NULL REFERENCES agents(id),
    
    -- Certification Details
    grade_at_certification VARCHAR(3) NOT NULL,
    truth_score_at_cert    DECIMAL(5,4) NOT NULL,
    min_trades_met         BOOLEAN DEFAULT FALSE,
    min_duration_met       BOOLEAN DEFAULT FALSE,
    
    -- Validity
    issued_at       TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    revoked         BOOLEAN DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ,
    revoke_reason   TEXT
);

CREATE INDEX idx_certifications_agent ON certifications(agent_id);
CREATE INDEX idx_certifications_active ON certifications(agent_id) WHERE NOT revoked;

-- ============================================================================
-- UPDATED VIEWS
-- ============================================================================

-- Agent leaderboard view (rating-focused)
DROP VIEW IF EXISTS v_agent_leaderboard;
CREATE VIEW v_agent_leaderboard AS
SELECT 
    a.id,
    a.name,
    a.provider,
    a.model,
    a.truth_score,
    a.grade,
    a.certified,
    a.brier_score,
    a.sharpe_ratio,
    a.max_drawdown,
    a.total_trades,
    a.winning_trades,
    CASE WHEN a.total_trades > 0 
        THEN ROUND(a.winning_trades::DECIMAL / a.total_trades, 4) 
        ELSE 0 
    END as win_rate,
    a.total_pnl,
    w.available + w.locked as total_balance,
    a.last_active_at
FROM agents a
LEFT JOIN wallets w ON a.id = w.agent_id
WHERE a.status = 'active'
ORDER BY a.truth_score DESC, a.total_pnl DESC;

-- ============================================================================
-- SEED DATA FOR TESTING
-- ============================================================================

-- Insert a test agent (for development)
-- API Key: "tn_test_key_development_only" (hash this in production!)
-- INSERT INTO agents (name, description, api_key_hash, provider, model)
-- VALUES (
--     'TestAgent-001',
--     'Development test agent',
--     crypt('tn_test_key_development_only', gen_salt('bf')),
--     'OpenAI',
--     'gpt-4o'
-- );
