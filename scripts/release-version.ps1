# Atualiza versão nos arquivos, commita, cria release/<versão> e volta para main.
#
# Uso:
#   npm run release:version -- 1.1.6
#
# Opções:
#   -Push   git push de main e release/<versão>

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Version,

  [switch] $Push
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'release-lib.ps1')

$Version = Assert-SemVer $Version
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$releaseBranch = "release/$Version"

Set-Location $repoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git não encontrado.'
}

Write-Host ''
Write-Host "=== Versão $Version (git) ===" -ForegroundColor Cyan
Write-Host ''

Write-Host '[1/2] Atualizando arquivos do projeto ...' -ForegroundColor Cyan
Set-ProjectVersion $repoRoot $Version

Write-Host '[2/2] Commit, branch, volta para main ...' -ForegroundColor Cyan
Invoke-ReleaseGit -Version $Version -ReleaseBranch $releaseBranch -DoPush:$Push

Write-Host ''
Write-Host '=== Próximo passo ===' -ForegroundColor Green
Write-Host '  npm run tauri:build:release'
Write-Host "  npm run release:publish -- $Version"
