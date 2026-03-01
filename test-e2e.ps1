# TRUTH-NET End-to-End Test Suite (PowerShell)
#
# Tests the complete pipeline:
# 1. Health check → 2. Register agent → 3. Markets → 4. Predict → 5. Rating → 6. Leaderboard
#
# Usage: .\test-e2e.ps1 [-BaseUrl "http://localhost:3000"]

param(
    [string]$BaseUrl = "http://localhost:3000"
)

$passed = 0
$failed = 0

function Log-Pass($msg) { Write-Host "  PASS " -ForegroundColor Green -NoNewline; Write-Host $msg; $script:passed++ }
function Log-Fail($msg) { Write-Host "  FAIL " -ForegroundColor Red -NoNewline; Write-Host $msg; $script:failed++ }
function Log-Info($msg) { Write-Host "  -> " -ForegroundColor Cyan -NoNewline; Write-Host $msg }

Write-Host ""
Write-Host "  TRUTH-NET End-to-End Test Suite" -ForegroundColor Cyan
Write-Host "  Testing: $BaseUrl"
Write-Host "  ========================================" -ForegroundColor DarkGray
Write-Host ""

# Test 1: Health
Log-Info "Test 1: Health Check"
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -ErrorAction Stop
    if ($health.status -eq "healthy" -or $health.status -eq "ok") { Log-Pass "Health OK" } else { Log-Fail "Health not OK: $($health.status)" }
} catch { Log-Fail "Health check failed: $_" }

# Test 2: Markets
Log-Info "Test 2: List Markets"
try {
    $markets = Invoke-RestMethod -Uri "$BaseUrl/v1/markets" -ErrorAction Stop
    $total = $markets.data.total
    if ($total -gt 0) {
        Log-Pass "Markets loaded: $total markets"
        $firstMarketId = $markets.data.markets[0].id
        $firstMarketTitle = $markets.data.markets[0].title
        Log-Info "  First: $firstMarketTitle"
    } else { Log-Fail "No markets" }
} catch { Log-Fail "Markets failed: $_" }

# Test 3: Register External Agent
Log-Info "Test 3: Register External Agent"
try {
    $body = @{ name = "E2E Test Agent"; description = "PowerShell test"; provider = "test"; model = "test-v1" } | ConvertTo-Json
    $reg = Invoke-RestMethod -Uri "$BaseUrl/v1/external-agents/register" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    $agentId = $reg.data.agent_id
    $apiKey = $reg.data.api_key
    if ($agentId) {
        Log-Pass "Agent registered: $agentId"
        Log-Info "  API Key: $($apiKey.Substring(0,20))..."
    } else { Log-Fail "Registration failed" }
} catch { Log-Fail "Registration failed: $_" }

# Test 4: Submit Prediction
if ($agentId -and $firstMarketId) {
    Log-Info "Test 4: Submit Prediction"
    try {
        $predBody = @{ market_id = $firstMarketId; probability = 0.72; confidence = 0.8; reasoning = "E2E test" } | ConvertTo-Json
        $headers = @{ "X-API-Key" = $apiKey }
        $pred = Invoke-RestMethod -Uri "$BaseUrl/v1/external-agents/$agentId/predict" -Method POST -Body $predBody -ContentType "application/json" -Headers $headers -ErrorAction Stop
        if ($pred.success) {
            $action = $pred.data.action
            Log-Pass "Prediction submitted: action=$action"
        } else { Log-Fail "Prediction failed" }
    } catch { Log-Fail "Prediction failed: $_" }
}

# Test 5: Check Rating
if ($agentId) {
    Log-Info "Test 5: Check Agent Rating"
    try {
        $rating = Invoke-RestMethod -Uri "$BaseUrl/v1/external-agents/$agentId/rating" -ErrorAction Stop
        $score = $rating.data.truth_score
        $grade = $rating.data.grade
        Log-Pass "Rating: TruthScore=$([math]::Round($score, 1)), Grade=$grade"
    } catch { Log-Fail "Rating check failed: $_" }
}

# Test 6: Leaderboard
Log-Info "Test 6: Leaderboard"
try {
    $leader = Invoke-RestMethod -Uri "$BaseUrl/v1/ratings/leaderboard?limit=20&include_unrated=true" -ErrorAction Stop
    $count = $leader.data.total
    Log-Pass "Leaderboard: $count agents"
} catch { Log-Fail "Leaderboard failed: $_" }

# Test 7: Trading Stats
Log-Info "Test 7: Trading Stats"
try {
    $stats = Invoke-RestMethod -Uri "$BaseUrl/v1/trading/stats" -ErrorAction Stop
    $ticks = $stats.data.ticks
    $agents = $stats.data.agents
    Log-Pass "Trading: $ticks ticks, $agents agents"
} catch { Log-Fail "Trading stats failed: $_" }

# Test 8: Reasoning Feed
Log-Info "Test 8: Reasoning Feed"
try {
    $reason = Invoke-RestMethod -Uri "$BaseUrl/v1/reasoning" -ErrorAction Stop
    if ($reason.success) { Log-Pass "Reasoning feed accessible" } else { Log-Fail "Reasoning feed failed" }
} catch { Log-Fail "Reasoning feed failed: $_" }

# Test 9: Prediction History
if ($agentId) {
    Log-Info "Test 9: Prediction History"
    try {
        $hist = Invoke-RestMethod -Uri "$BaseUrl/v1/external-agents/$agentId/predictions" -ErrorAction Stop
        $predCount = $hist.data.total
        Log-Pass "Prediction history: $predCount predictions"
    } catch { Log-Fail "History failed: $_" }
}

# Summary
Write-Host ""
Write-Host "  ========================================" -ForegroundColor DarkGray
Write-Host "  Results: " -NoNewline
Write-Host "$passed passed" -ForegroundColor Green -NoNewline
Write-Host ", " -NoNewline
Write-Host "$failed failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""
