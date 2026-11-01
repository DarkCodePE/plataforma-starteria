$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$front = Join-Path $repo 'front'
$runtime = Join-Path $repo 'artifacts\mvp-integration\runtime'
$runtimeLogs = Join-Path (Split-Path -Parent $repo) '_qa-runtime\MVP-INT-01-20261026'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
New-Item -ItemType Directory -Force -Path $runtimeLogs | Out-Null

function Wait-Http([string]$Url, [string]$Name) {
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
      if ($response.StatusCode -lt 500) { return }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  throw "$Name did not become ready at $Url"
}

$mailpit = docker ps -a --filter 'name=^/starteria_mvp_int01_mailpit$' --format '{{.Names}}'
if ($mailpit -eq 'starteria_mvp_int01_mailpit') {
  docker start starteria_mvp_int01_mailpit | Out-Null
} else {
  docker run -d --name starteria_mvp_int01_mailpit -p 127.0.0.1:1027:1025 -p 127.0.0.1:8027:8025 axllent/mailpit:latest | Out-Null
}

$env:MVP_QA_AI_STUB_PORT = '8004'
$aiStub = Start-Process -FilePath 'node.exe' `
  -ArgumentList @(Join-Path $repo 'scripts\mvp-integration\qa-ai-stub.cjs') `
  -WorkingDirectory $repo -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $runtimeLogs 'ai-stub.out.log') `
  -RedirectStandardError (Join-Path $runtimeLogs 'ai-stub.err.log')

$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55436/postgres?schema=public'
$env:PORT = '4105'
$env:JWT_SECRET = 'mvp-int01-local-qa-only-20261026'
$env:AUTH_DISABLE_WAITLIST = 'true'
$env:AUTH_RATE_LIMIT_DISABLED = 'true'
$env:CORS_ORIGIN = 'http://127.0.0.1:5181'
$env:AI_SERVICE_URL = 'http://127.0.0.1:8004'
$env:AI_SERVICE_SECRET = 'mvp-int01-qa-stub-secret'
$env:STEP_REASONING_COPILOT_ENABLED = 'true'
$env:STEP_REASONING_COPILOT_EMERGENCY_DISABLED = 'false'
$env:STEP_REASONING_PROVIDER_MODE = 'qa_stub'
$env:SMTP_HOST = '127.0.0.1'
$env:SMTP_PORT = '1027'
$env:SMTP_SECURE = 'false'
$env:PILOT_LEAD_NOTIFY_FROM = 'qa@starteria.test'
$env:NODE_PATH = Join-Path $front 'node_modules'
$backend = Start-Process -FilePath 'node.exe' `
  -ArgumentList @((Join-Path $front 'node_modules\tsx\dist\cli.mjs'), (Join-Path $repo 'backend\server.ts')) `
  -WorkingDirectory $front -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $runtimeLogs 'backend.out.log') `
  -RedirectStandardError (Join-Path $runtimeLogs 'backend.err.log')

$env:VITE_API_URL = '/api/v1'
$env:VITE_BACKEND_PROXY_TARGET = 'http://127.0.0.1:4105'
$env:VITE_STEP_REASONING_COPILOT_ENABLED = 'true'
$frontend = Start-Process -FilePath 'node.exe' `
  -ArgumentList @((Join-Path $front 'node_modules\vite\bin\vite.js'), '--host', '127.0.0.1', '--port', '5181', '--strictPort') `
  -WorkingDirectory $front -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $runtimeLogs 'frontend.out.log') `
  -RedirectStandardError (Join-Path $runtimeLogs 'frontend.err.log')

[ordered]@{ frontend = $frontend.Id; backend = $backend.Id; aiStub = $aiStub.Id } |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtime 'qa-pids.json') -Encoding UTF8

Wait-Http 'http://127.0.0.1:8004/health' 'AI stub'
Wait-Http 'http://127.0.0.1:4105/api/health' 'Backend'
Wait-Http 'http://127.0.0.1:5181/' 'Frontend'
Wait-Http 'http://127.0.0.1:8027/' 'Mailpit'

Write-Output 'MVP_INT01_QA_READY frontend=http://127.0.0.1:5181 backend=http://127.0.0.1:4105 ai_stub=http://127.0.0.1:8004 mailpit=http://127.0.0.1:8027 postgres=127.0.0.1:55436'
