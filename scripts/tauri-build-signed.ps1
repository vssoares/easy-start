# Build Tauri de release com assinatura do updater (NSIS + .sig).
# Uso: .\scripts\tauri-build-signed.ps1
#      npm run tauri:build:release

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$keyPath = Join-Path $env:USERPROFILE '.tauri\easy-start.key'

if (-not (Test-Path $keyPath)) {
  throw @"
Chave não encontrada: $keyPath
Gere com: npm run tauri signer generate -- -w `"$keyPath`" --ci --force
"@
}

foreach ($name in @(
    'TAURI_SIGNING_PRIVATE_KEY',
    'TAURI_SIGNING_PRIVATE_KEY_PATH',
    'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
    'TAURI_PRIVATE_KEY',
    'TAURI_PRIVATE_KEY_PATH',
    'TAURI_PRIVATE_KEY_PASSWORD'
  )) {
  Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
}

$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -Raw -Path $keyPath).TrimEnd()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''

Write-Host "Assinatura: $keyPath" -ForegroundColor Cyan
Write-Host 'Build: npx tauri build --config src-tauri/tauri.ci.conf.json --ci' -ForegroundColor DarkGray

Set-Location $repoRoot
& npx --no-install tauri build --config src-tauri/tauri.ci.conf.json --ci
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host 'Build concluído. Artefatos em src-tauri/target/release/bundle/nsis/' -ForegroundColor Green
