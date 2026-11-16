# Verification environment for the load/resilience checks (local only).
#
#   powershell -File loadtest/start-verify-env.ps1
#
# Starts a mock MediaWiki upstream plus a production build of the app wired to
# it, with short TTLs so outage behaviour is observable in seconds.
# Nothing here points at the live wiki.

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
Set-Location (Join-Path $PSScriptRoot '..')

$APP_PORT = 3230
$MOCK_PORT = 4599
$MOCK = "http://127.0.0.1:$MOCK_PORT"
$APP = "http://localhost:$APP_PORT"

foreach ($port in @($APP_PORT, $MOCK_PORT)) {
  $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($o in $owners) { Stop-Process -Id $o -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 2

# Fresh route/data caches so previous runs cannot influence the results.
Remove-Item -Recurse -Force '.next\cache' -ErrorAction SilentlyContinue

Start-Process -FilePath 'node' -ArgumentList 'loadtest\mock-mediawiki.mjs' -WindowStyle Hidden `
  -RedirectStandardOutput '.perf-mock.log' -RedirectStandardError '.perf-mock.err'

$env:MEDIAWIKI_BASE_URL = $MOCK
$env:PUBLIC_SITE_URL = $APP
$env:MEDIAWIKI_ARTICLE_TTL_MS = '5000'
$env:MEDIAWIKI_ARTICLE_STALE_MS = '600000'
$env:MEDIAWIKI_SEARCH_TTL_MS = '5000'
$env:MEDIAWIKI_PORTAL_TTL_MS = '5000'
$env:MEDIAWIKI_TIMEOUT_MS = '1500'
$env:MEDIAWIKI_SEARCH_TIMEOUT_MS = '1200'
$env:MEDIAWIKI_MAX_CONCURRENCY = '6'
$env:MEDIAWIKI_SEARCH_CONCURRENCY = '3'
$env:MEDIAWIKI_CIRCUIT_FAILURES = '3'
$env:MEDIAWIKI_CIRCUIT_OPEN_MS = '6000'
$env:REVALIDATION_SECRET = 'test-secret'

Start-Process -FilePath 'cmd.exe' -ArgumentList "/c", "node_modules\.bin\next.cmd start -p $APP_PORT" -WindowStyle Hidden `
  -RedirectStandardOutput '.perf-app.log' -RedirectStandardError '.perf-app.err'

$deadline = (Get-Date).AddSeconds(60)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    if ((Invoke-WebRequest "$APP/" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { $ready = $true; break }
  } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $ready) {
  Write-Output "app did not become ready - see .perf-app.log"
  Get-Content '.perf-app.log' -ErrorAction SilentlyContinue | Select-Object -First 10
  exit 1
}
Write-Output "mock: $MOCK  app: $APP"
Write-Output "verify: node loadtest/verify-behavior.mjs --app $APP --mock $MOCK --secret test-secret"
