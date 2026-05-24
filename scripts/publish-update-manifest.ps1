# Publica latest.json local no GitHub Pages (correção manual quando o CI não subiu o manifesto).
# Requer: build com `npm run tauri:build` e chave de assinatura já usada no app.

param(
  [string] $Version = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error 'Git não encontrado.'
}

$manifest = Get-ChildItem -Path src-tauri/target -Recurse -Filter latest.json -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $manifest) {
  Write-Error 'latest.json não encontrado. Rode: npm run tauri:build (com TAURI_SIGNING_PRIVATE_KEY)'
}

if (-not $Version) {
  $conf = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json
  $Version = $conf.version
}

$workDir = Join-Path $env:TEMP "easy-start-updater-pages"
if (Test-Path $workDir) {
  Remove-Item -Recurse -Force $workDir
}
New-Item -ItemType Directory -Path $workDir | Out-Null
Copy-Item $manifest.FullName (Join-Path $workDir 'latest.json')

Write-Host "Publicando latest.json (v$Version) na branch gh-pages ..." -ForegroundColor Cyan

$cloneDir = Join-Path $env:TEMP 'easy-start-gh-pages'
if (Test-Path $cloneDir) {
  Remove-Item -Recurse -Force $cloneDir
}

git clone --branch gh-pages --single-branch (git remote get-url origin) $cloneDir 2>$null
if ($LASTEXITCODE -ne 0) {
  git clone --depth 1 (git remote get-url origin) $cloneDir
  Set-Location $cloneDir
  git checkout --orphan gh-pages
  git rm -rf . 2>$null
} else {
  Set-Location $cloneDir
}

Copy-Item (Join-Path $workDir 'latest.json') ./latest.json -Force
git add latest.json
git commit -m "chore(updater): manifest v$Version"
git push origin gh-pages

Set-Location $repoRoot
Write-Host ''
Write-Host 'Concluído. Teste:' -ForegroundColor Green
Write-Host '  https://vssoares.github.io/easy-start/latest.json'
Write-Host '  .\scripts\verify-update-manifest.ps1'
