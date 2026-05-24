# Envia latest.json local para o release no GitHub (correção manual).
# Requer: gh CLI autenticado e build com TAURI_SIGNING_PRIVATE_KEY.

param(
  [string] $Version = '',
  [string] $Tag = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error 'GitHub CLI (gh) não encontrado. Instale: https://cli.github.com/'
}

$manifest = Get-Item -Path (Join-Path $repoRoot 'latest.json') -ErrorAction SilentlyContinue
if (-not $manifest) {
  $manifest = Get-ChildItem -Path (Join-Path $repoRoot 'src-tauri/target') -Recurse -Filter latest.json -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

if (-not $manifest) {
  Write-Error 'latest.json não encontrado. Rode: npm run tauri:build (com TAURI_SIGNING_PRIVATE_KEY).'
}

if (-not $Version) {
  $conf = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json
  $Version = $conf.version
}

if (-not $Tag) {
  $Tag = "easy-start-v$Version"
}

Write-Host "Enviando latest.json para o release $Tag ..." -ForegroundColor Cyan
gh release upload $Tag $manifest.FullName --clobber

Set-Location $repoRoot
Write-Host ''
Write-Host 'Concluído. Teste:' -ForegroundColor Green
Write-Host '  https://github.com/vssoares/easy-start/releases/latest/download/latest.json'
Write-Host '  .\scripts\verify-update-manifest.ps1'
