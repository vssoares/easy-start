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
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
$null = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  $ErrorActionPreference = $prevEap
  throw 'gh não autenticado. Rode: gh auth login'
}
$ErrorActionPreference = $prevEap

Write-Host ''
Write-Host "=== Publicar v$Version ($tag) ===" -ForegroundColor Cyan
Write-Host ''

Write-Host '[1/4] Verificando build assinado ...' -ForegroundColor Cyan
$nsisDir = Assert-SignedBuild $repoRoot $Version

Write-Host '[2/4] Gerando latest.json ...' -ForegroundColor Cyan
Write-LatestJson -NsisDir $nsisDir -Version $Version -Tag $tag -Repo $Repo -Notes $Notes | Out-Null
$artifacts = Get-UploadArtifacts $nsisDir
Write-Host "  $($artifacts.Count) arquivo(s)" -ForegroundColor DarkGray

Write-Host '[3/4] GitHub Release ...' -ForegroundColor Cyan
$exists = Test-GhRelease -Tag $tag -Repo $Repo

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

Write-Host '[4/4] Sincronizando latest.json com URL real do asset ...' -ForegroundColor Cyan
$latestPath = Sync-LatestJsonFromGhRelease -NsisDir $nsisDir -Version $Version -Tag $tag -Repo $Repo -Notes $Notes
gh release upload $tag $latestPath --repo $Repo --clobber
if ($LASTEXITCODE -ne 0) { throw 'Falha ao reenviar latest.json.' }

Write-Host ''
Write-Host '=== Publicado ===' -ForegroundColor Green
Write-Host "  URL:     https://github.com/$Repo/releases/tag/$tag"
Write-Host "  Updater: $manifestUrl"
