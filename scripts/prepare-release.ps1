# Prepara uma release: cria branch, sincroniza versões e commita (sem push).
#
# Uso:
#   .\scripts\prepare-release.ps1 1.0.1
#   .\scripts\prepare-release.ps1 -Version 1.0.1
#   .\scripts\prepare-release.ps1 v1.0.1 -BranchName release

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Version,

  [string] $BranchName = ''
)

$ErrorActionPreference = 'Stop'

$Version = $Version.Trim().TrimStart('v')
if ($Version -notmatch '^\d+\.\d+\.\d+([\-.][0-9A-Za-z\-.]+)?(\+[0-9A-Za-z\-.]+)?$') {
  Write-Error "Versão inválida: '$Version'. Use semver, ex.: 1.0.1"
}

if (-not $BranchName) {
  $BranchName = "release/$Version"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error 'Git não encontrado no PATH.'
}

$pending = git status --porcelain
if ($pending) {
  Write-Host 'Alterações pendentes serão incluídas no commit de release:' -ForegroundColor Yellow
  Write-Host $pending
  Write-Host ''
}

$existing = git branch --list $BranchName
if ($existing) {
  Write-Error "A branch '$BranchName' já existe. Escolha outro nome com -BranchName ou apague a branch local."
}

$files = @{
  'src-tauri/tauri.conf.json' = {
    param($c, $v)
  $c -replace '("version"\s*:\s*")[^"]+(")', "`${1}$v`${2}"
  }
  'package.json' = {
    param($c, $v)
    $c -replace '("version"\s*:\s*")[^"]+(")', "`${1}$v`${2}"
  }
  'package-lock.json' = {
    param($c, $v)
    [regex]::Replace($c, '"name": "easy-start",\s*"version": "[^"]+"', "`"name`": `"easy-start`", `"version`": `"$v`"")
  }
  'src-tauri/Cargo.toml' = {
    param($c, $v)
    $c -replace '(?m)^version\s*=\s*"[^"]+"', "version = `"$v`""
  }
}

Write-Host "Criando branch '$BranchName' ..."
git checkout -b $BranchName

Write-Host "Atualizando versão para $Version ..."
foreach ($relPath in $files.Keys) {
  $path = Join-Path $repoRoot $relPath
  if (-not (Test-Path $path)) {
    Write-Warning "Arquivo não encontrado, ignorando: $relPath"
    continue
  }
  $content = Get-Content -Raw -Path $path
  $updated = & $files[$relPath] $content $Version
  if ($content -eq $updated) {
    Write-Warning "Nenhuma alteração em $relPath (campo version não encontrado?)"
  }
  Set-Content -Path $path -Value $updated -Encoding utf8
}

git add -A
git commit -m "chore(release): v$Version"

Write-Host ''
Write-Host 'Release preparada localmente.' -ForegroundColor Green
Write-Host "  Branch:  $BranchName"
Write-Host "  Versão:  $Version"
Write-Host ''
Write-Host 'Próximo passo (manual):'
Write-Host "  git push -u origin $BranchName"
Write-Host ''
Write-Host 'Depois no GitHub:'
Write-Host '  - O workflow Release roda ao receber push na branch release ou release/* (conforme seu workflow), ou'
Write-Host '  - Actions → Release → Run workflow'
Write-Host '  - Revise o rascunho do release e publique quando estiver pronto.'
