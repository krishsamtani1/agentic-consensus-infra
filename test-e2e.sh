#!/bin/bash
#
# TRUTH-NET End-to-End Test Flow
#
# Tests the complete pipeline:
# 1. Health check
# 2. Register an external agent
# 3. List markets
# 4. Submit predictions
# 5. Check rating
# 6. Check leaderboard
# 7. Verify trading stats
# 8. Check agent reasonings
#
# Usage: bash test-e2e.sh [BASE_URL]
# Default: http://localhost:3000

set -e

BASE="${1:-http://localhost:3000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
PASSED=0
FAILED=0

log_pass() { echo -e "${GREEN}✓ $1${NC}"; ((PASSED++)); }
log_fail() { echo -e "${RED}✗ $1${NC}"; ((FAILED++)); }
log_info() { echo -e "${CYAN}→ $1${NC}"; }

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   TRUTH-NET End-to-End Test Suite                ║"
echo "║   Testing: $BASE"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ===================================================
# TEST 1: Health Check
# ===================================================
log_info "Test 1: Health Check"
HEALTH=$(curl -s "$BASE/health")
if echo "$HEALTH" | grep -q '"status":"healthy"\|"status":"ok"'; then
  log_pass "Health check passed"
else
  log_fail "Health check failed: $HEALTH"
fi

# ===================================================
# TEST 2: API Root
# ===================================================
log_info "Test 2: API Root"
ROOT=$(curl -s "$BASE/")
if echo "$ROOT" | grep -q 'TRUTH-NET'; then
  log_pass "API root responded"
else
  log_fail "API root failed: $ROOT"
fi

# ===================================================
# TEST 3: List Markets
# ===================================================
log_info "Test 3: List Markets"
MARKETS=$(curl -s "$BASE/v1/markets")
MARKET_COUNT=$(echo "$MARKETS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total',0))" 2>/dev/null || echo "0")
if [ "$MARKET_COUNT" -gt 0 ] 2>/dev/null; then
  log_pass "Markets loaded: $MARKET_COUNT markets"
  FIRST_MARKET_ID=$(echo "$MARKETS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['markets'][0]['id'])" 2>/dev/null)
  FIRST_MARKET_TITLE=$(echo "$MARKETS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['markets'][0]['title'])" 2>/dev/null)
  log_info "  First market: $FIRST_MARKET_TITLE"
else
  log_fail "No markets found"
  FIRST_MARKET_ID=""
fi

# ===================================================
# TEST 4: Register External Agent
# ===================================================
log_info "Test 4: Register External Agent"
REGISTER_RESP=$(curl -s -X POST "$BASE/v1/external-agents/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Test Agent","description":"Automated test agent","provider":"test","model":"test-v1"}')

AGENT_ID=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('agent_id',''))" 2>/dev/null)
API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('api_key',''))" 2>/dev/null)

if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "" ]; then
  log_pass "Agent registered: $AGENT_ID"
  log_info "  API Key: ${API_KEY:0:20}..."
else
  log_fail "Agent registration failed: $REGISTER_RESP"
fi

# ===================================================
# TEST 5: Submit Prediction
# ===================================================
if [ -n "$FIRST_MARKET_ID" ] && [ -n "$AGENT_ID" ]; then
  log_info "Test 5: Submit Prediction"
  PREDICT_RESP=$(curl -s -X POST "$BASE/v1/external-agents/$AGENT_ID/predict" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"market_id\":\"$FIRST_MARKET_ID\",\"probability\":0.72,\"confidence\":0.8,\"reasoning\":\"E2E test prediction\"}")

  if echo "$PREDICT_RESP" | grep -q '"success":true'; then
    ACTION=$(echo "$PREDICT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('action',''))" 2>/dev/null)
    log_pass "Prediction submitted: action=$ACTION"
  else
    log_fail "Prediction failed: $PREDICT_RESP"
  fi

  # Submit a second prediction with opposite view
  log_info "Test 5b: Submit Second Prediction (opposing view)"
  PREDICT2_RESP=$(curl -s -X POST "$BASE/v1/external-agents/$AGENT_ID/predict" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"market_id\":\"$FIRST_MARKET_ID\",\"probability\":0.25,\"confidence\":0.6,\"reasoning\":\"Contrarian E2E test\"}")

  if echo "$PREDICT2_RESP" | grep -q '"success":true'; then
    log_pass "Second prediction submitted"
  else
    log_info "  Second prediction result: $PREDICT2_RESP"
  fi
fi

# ===================================================
# TEST 6: Check Agent Rating
# ===================================================
if [ -n "$AGENT_ID" ]; then
  log_info "Test 6: Check Agent Rating"
  RATING_RESP=$(curl -s "$BASE/v1/external-agents/$AGENT_ID/rating")
  if echo "$RATING_RESP" | grep -q '"truth_score"'; then
    SCORE=$(echo "$RATING_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('truth_score',0))" 2>/dev/null)
    GRADE=$(echo "$RATING_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('grade',''))" 2>/dev/null)
    log_pass "Rating retrieved: TruthScore=$SCORE, Grade=$GRADE"
  else
    log_fail "Rating check failed: $RATING_RESP"
  fi
fi

# ===================================================
# TEST 7: Check Prediction History
# ===================================================
if [ -n "$AGENT_ID" ]; then
  log_info "Test 7: Check Prediction History"
  HISTORY_RESP=$(curl -s "$BASE/v1/external-agents/$AGENT_ID/predictions")
  PRED_COUNT=$(echo "$HISTORY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total',0))" 2>/dev/null || echo "0")
  if [ "$PRED_COUNT" -gt 0 ] 2>/dev/null; then
    log_pass "Prediction history: $PRED_COUNT predictions"
  else
    log_info "  No predictions recorded yet"
  fi
fi

# ===================================================
# TEST 8: Leaderboard
# ===================================================
log_info "Test 8: Leaderboard"
LEADER_RESP=$(curl -s "$BASE/v1/ratings/leaderboard?limit=20&include_unrated=true")
if echo "$LEADER_RESP" | grep -q '"leaderboard"'; then
  LEADER_COUNT=$(echo "$LEADER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total',0))" 2>/dev/null || echo "0")
  log_pass "Leaderboard loaded: $LEADER_COUNT agents"
else
  log_fail "Leaderboard failed: $LEADER_RESP"
fi

# ===================================================
# TEST 9: Trading Stats
# ===================================================
log_info "Test 9: Trading Stats"
STATS_RESP=$(curl -s "$BASE/v1/trading/stats")
if echo "$STATS_RESP" | grep -q '"success":true'; then
  TICKS=$(echo "$STATS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('ticks',0))" 2>/dev/null || echo "0")
  AGENTS=$(echo "$STATS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('agents',0))" 2>/dev/null || echo "0")
  log_pass "Trading stats: $TICKS ticks, $AGENTS agents"
else
  log_fail "Trading stats failed: $STATS_RESP"
fi

# ===================================================
# TEST 10: LLM Reasoning Feed
# ===================================================
log_info "Test 10: Agent Reasoning Feed"
REASON_RESP=$(curl -s "$BASE/v1/reasoning")
if echo "$REASON_RESP" | grep -q '"success":true'; then
  log_pass "Reasoning feed accessible"
else
  log_fail "Reasoning feed failed: $REASON_RESP"
fi

# ===================================================
# TEST 11: External Agents List
# ===================================================
log_info "Test 11: External Agents List"
EXT_RESP=$(curl -s "$BASE/v1/external-agents")
if echo "$EXT_RESP" | grep -q '"success":true'; then
  EXT_COUNT=$(echo "$EXT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total',0))" 2>/dev/null || echo "0")
  log_pass "External agents: $EXT_COUNT registered"
else
  log_fail "External agents list failed"
fi

# ===================================================
# SUMMARY
# ===================================================
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Results: $PASSED passed, $FAILED failed"
echo "╚══════════════════════════════════════════════════╝"
echo ""

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
