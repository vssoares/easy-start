# Publica no GitHub Release os artefatos de src-tauri/target/release/bundle/nsis/.
#
# Uso:
#   npm run release:publish -- 1.1.6
#
# Opções:
#   -Force   recria o release/tag se já existir
#   -Notes   notas do release no GitHub

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Version,

  [string] $Repo = 'vssoares/easy-start',
  [switch] $Force,
  [string] $Notes = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'release-lib.ps1')

$Version = Assert-SemVer $Version
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$tag = "easy-start-v$Version"
$manifestUrl = "https://github.com/vssoares/easy-start/releases/latest/download/latest.json"

Set-Location $repoRoot

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'GitHub CLI não encontrado. Rode: gh auth login'
}
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'gh não autenticado. Rode: gh auth login'
}

Write-Host ''
Write-Host "=== Publicar v$Version ($tag) ===" -ForegroundColor Cyan
Write-Host ''

Write-Host '[1/3] Verificando build assinado ...' -ForegroundColor Cyan
$nsisDir = Assert-SignedBuild $repoRoot $Version

Write-Host '[2/3] Gerando latest.json ...' -ForegroundColor Cyan
Write-LatestJson -NsisDir $nsisDir -Version $Version -Tag $tag -Repo $Repo -Notes $Notes | Out-Null
$artifacts = Get-UploadArtifacts $nsisDir
Write-Host "  $($artifacts.Count) arquivo(s)" -ForegroundColor DarkGray

Write-Host '[3/3] GitHub Release ...' -ForegroundColor Cyan
$exists = $false
gh release view $tag --repo $Repo 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $exists = $true }

if ($exists -and $Force) {
  gh release delete $tag --repo $Repo --yes --cleanup-tag
  if ($LASTEXITCODE -ne 0) { throw "Falha ao apagar $tag" }
  $exists = $false
}

if (-not $exists) {
  if (-not $Notes) {
    $Notes = @"
Instalador Windows e atualização automática.

Manifesto: $manifestUrl
"@
  }
  gh release create $tag --repo $Repo --title "Easy Start v$Version" --notes $Notes --target main
  if ($LASTEXITCODE -ne 0) { throw "Falha ao criar release $tag" }
  Write-Host "  Release criado." -ForegroundColor Green
} else {
  Write-Host "  Release existente; atualizando assets." -ForegroundColor Yellow
}

gh release upload $tag $artifacts --repo $Repo --clobber
if ($LASTEXITCODE -ne 0) { throw 'Falha no upload.' }

Write-Host ''
Write-Host '=== Publicado ===' -ForegroundColor Green
Write-Host "  URL:     https://github.com/$Repo/releases/tag/$tag"
Write-Host "  Updater: $manifestUrl"
