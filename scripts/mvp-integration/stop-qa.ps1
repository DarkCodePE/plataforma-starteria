$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pidFile = Join-Path $repo 'artifacts\mvp-integration\runtime\qa-pids.json'

if (Test-Path -LiteralPath $pidFile) {
  $processes = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
  foreach ($processId in @($processes.frontend, $processes.backend, $processes.aiStub)) {
    if ($processId) { & taskkill.exe /PID $processId /T /F 2>$null | Out-Null }
  }
}

docker rm -f starteria_mvp_int01_mailpit 2>$null | Out-Null
Write-Output 'MVP_INT01_QA_PROCESSES_STOPPED (PostgreSQL preserved)'
