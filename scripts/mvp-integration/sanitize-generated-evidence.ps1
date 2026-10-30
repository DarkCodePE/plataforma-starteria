$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$allowedRoot = [System.IO.Path]::GetFullPath($repo).TrimEnd('\') + '\'
$targets = @(
  (Join-Path $repo 'artifacts\mvp-integration\regression-failures'),
  (Join-Path $repo 'front\test-results'),
  (Join-Path $repo 'artifacts\KAN-178'),
  (Join-Path $repo 'artifacts\steps-ux02b'),
  (Join-Path $repo 'artifacts\e2e-goal')
)

foreach ($target in $targets) {
  $resolved = [System.IO.Path]::GetFullPath($target)
  if (-not $resolved.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to delete outside worktree: $resolved"
  }
  if (Test-Path -LiteralPath $resolved) {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}

$runtime = [System.IO.Path]::GetFullPath((Join-Path $repo 'artifacts\mvp-integration\runtime'))
if (-not $runtime.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clean runtime outside worktree: $runtime"
}

Get-ChildItem -LiteralPath $runtime -File -Filter '*.log' | Remove-Item -Force
Write-Output 'MVP_INT01_GENERATED_EVIDENCE_SANITIZED'
