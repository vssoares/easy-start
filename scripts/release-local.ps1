# Git + publicação no GitHub (artefatos já buildados com npm run tauri:build:release).
#
# Ordem:
#   1. npm run tauri:build:release
#   2. npm run release:local          # bump (opcional) + commit + branch release/* + volta à main + upload
#
# Antes do passo 1, defina a versão nos arquivos (uma opção):
#   npm run release:local -- -VersionOnly
#   npm run release:local -- 1.2.0 -VersionOnly
#
# Opções:
#   -VersionOnly              Só atualiza versão nos arquivos (rode antes do build)
#   -Bump patch|minor|major   Incremento na detecção automática (com -VersionOnly ou sem build ainda)
#   -Confirm                  Pede confirmação antes de publicar
#   -DryRun                   Só mostra a versão detectada
#   -SkipVersionBump          Não altera arquivos; usa versão do instalador buildado
#   -SkipGit                  Não commita nem cria branch release/*
#   -SkipVerify               Não testa latest.json após publicar
#   -Force                    Recria o release/tag se já existir
#   -Push                     git push da branch principal e de release/*
#   -BranchName               Nome da branch de release (padrão: release/<versão>)
#   -Notes "texto"            Notas do release

param(
  [Parameter(Mandatory = $false, Position = 0)]
  [string] $Version = '',

  [ValidateSet('patch', 'minor', 'major')]
  [string] $Bump = 'patch',

  [string] $Repo = 'vssoares/easy-start',
  [string] $BranchName = '',
  [switch] $VersionOnly,
  [switch] $SkipVersionBump,
  [switch] $SkipGit,
  [switch] $SkipVerify,
  [switch] $Force,
  [switch] $Push,
  [switch] $Confirm,
  [switch] $DryRun,
  [string] $Notes = ''
)

$ErrorActionPreference = 'Stop'

function Read-TextFile([string] $Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
  }
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Write-TextFile([string] $Path, [string] $Content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Assert-SemVer([string] $v) {
  $v = $v.Trim().TrimStart('v')
  if ($v -notmatch '^(\d+)\.(\d+)\.(\d+)([\-.][0-9A-Za-z\-.]+)?(\+[0-9A-Za-z\-.]+)?$') {
    throw "Versão inválida: '$v'. Use semver, ex.: 1.1.4"
  }
  foreach ($part in @($Matches[1], $Matches[2], $Matches[3])) {
    if ($part.Length -gt 1 -and $part.StartsWith('0')) {
      throw "Versão inválida: '$v'. Sem zeros à esquerda (use 1.1.4, não 1.01.4)."
    }
  }
  return $v
}

function Set-ProjectVersion([string] $repoRoot, [string] $v) {
  $files = @{
    'src-tauri/tauri.conf.json' = {
      param($c, $ver)
      $c -replace '("version"\s*:\s*")[^"]+(")', "`${1}$ver`${2}"
    }
    'package.json' = {
      param($c, $ver)
      $c -replace '("version"\s*:\s*")[^"]+(")', "`${1}$ver`${2}"
    }
    'package-lock.json' = {
      param($c, $ver)
      [regex]::Replace($c, '"name": "easy-start",\s*"version": "[^"]+"', "`"name`": `"easy-start`", `"version`": `"$ver`"")
    }
    'src-tauri/Cargo.toml' = {
      param($c, $ver)
      $c -replace '(?m)^version\s*=\s*"[^"]+"', "version = `"$ver`""
    }
  }

  foreach ($relPath in $files.Keys) {
    $path = Join-Path $repoRoot $relPath
    if (-not (Test-Path $path)) {
      Write-Warning "Arquivo não encontrado, ignorando: $relPath"
      continue
    }
    $content = Read-TextFile $path
    $updated = & $files[$relPath] $content $v
    if ($content -eq $updated) {
      Write-Warning "Nenhuma alteração em $relPath (campo version não encontrado?)"
    }
    Write-TextFile $path $updated
  }
}

function Get-CurrentProjectVersion([string] $repoRoot) {
  $confPath = Join-Path $repoRoot 'src-tauri/tauri.conf.json'
  $conf = Get-Content $confPath -Raw | ConvertFrom-Json
  return [string]$conf.version
}

function Compare-SemVerCore([string] $a, [string] $b) {
  $va = [version](Assert-SemVer $a)
  $vb = [version](Assert-SemVer $b)
  return $va.CompareTo($vb)
}

function Bump-SemVerCore([string] $v, [string] $kind) {
  $v = Assert-SemVer $v
  if ($v -notmatch '^(\d+)\.(\d+)\.(\d+)') {
    throw "Não é possível incrementar versão com sufixo pré-release: $v"
  }
  $maj = [int]$Matches[1]
  $min = [int]$Matches[2]
  $pat = [int]$Matches[3]
  switch ($kind) {
    'major' { return "$($maj + 1).0.0" }
    'minor' { return "$maj.$($min + 1).0" }
    default  { return "$maj.$min.$($pat + 1)" }
  }
}

function Get-LatestPublishedVersion([string] $repo) {
  $raw = gh release list --repo $repo --limit 100 --json tagName 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  $releases = $raw | ConvertFrom-Json
  $prefix = 'easy-start-v'
  $best = $null

  foreach ($entry in $releases) {
    $tag = [string]$entry.tagName
    if ($tag -notlike "$prefix*") {
      continue
    }
    try {
      $ver = Assert-SemVer $tag.Substring($prefix.Length)
      if (-not $best -or (Compare-SemVerCore $ver $best) -gt 0) {
        $best = $ver
      }
    } catch {
      continue
    }
  }

  return $best
}

function Resolve-NextReleaseVersion {
  param(
    [string] $Repo,
    [string] $RepoRoot,
    [string] $ExplicitVersion,
    [string] $BumpKind,
    [switch] $SkipVersionBump
  )

  $project = Get-CurrentProjectVersion $RepoRoot
  $project = Assert-SemVer $project

  if ($ExplicitVersion) {
    return @{
      Version = (Assert-SemVer $ExplicitVersion)
      Source  = 'informada manualmente'
    }
  }

  if ($SkipVersionBump) {
    return @{
      Version = $project
      Source  = 'arquivos do projeto (-SkipVersionBump)'
    }
  }

  $published = Get-LatestPublishedVersion $Repo

  Write-Host 'Detectando versão ...' -ForegroundColor Cyan
  Write-Host "  Projeto (tauri.conf.json): $project"
  if ($published) {
    Write-Host "  Última publicada (GitHub):   $published"
  } else {
    Write-Host '  Última publicada (GitHub):   (nenhuma release easy-start-v*)'
  }

  if (-not $published) {
    if ((Compare-SemVerCore $project '0.0.0') -le 0) {
      throw 'Versão do projeto inválida ou 0.0.0; informe -Version ou ajuste tauri.conf.json'
    }
    return @{
      Version = $project
      Source  = 'versão do projeto (primeira release no GitHub)'
    }
  }

  $cmpProjectVsPublished = Compare-SemVerCore $project $published

  if ($cmpProjectVsPublished -gt 0) {
    return @{
      Version = $project
      Source  = 'projeto já está à frente da última release publicada'
    }
  }

  if ($cmpProjectVsPublished -eq 0) {
    $next = Bump-SemVerCore $project $BumpKind
    return @{
      Version = $next
      Source  = "incremento -Bump $BumpKind (projeto = última publicada)"
    }
  }

  Write-Warning "Versão no projeto ($project) é menor que a última publicada ($published). Usando incremento a partir do GitHub."
  $next = Bump-SemVerCore $published $BumpKind
  return @{
    Version = $next
    Source  = "incremento -Bump $BumpKind a partir da última publicada"
  }
}

function Assert-Command([string] $name, [string] $installHint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name não encontrado no PATH. $installHint"
  }
}

function Find-NsisBundleDir([string] $repoRoot) {
  $base = Join-Path $repoRoot 'src-tauri/target/release/bundle/nsis'
  if (-not (Test-Path $base)) {
    throw "Pasta de build não encontrada: $base`nRode o build ou remova -SkipBuild."
  }
  return (Resolve-Path $base).Path
}

function Write-UpdaterLatestJson {
  param(
    [string] $NsisDir,
    [string] $Version,
    [string] $Tag,
    [string] $Repo,
    [string] $Notes = ''
  )

  $setupExe = Get-ChildItem -Path $NsisDir -File -Filter '*setup.exe' |
    Where-Object { $_.Extension -eq '.exe' } |
    Select-Object -First 1

  if (-not $setupExe) {
    $setupExe = Get-ChildItem -Path $NsisDir -File -Filter '*.exe' |
      Where-Object { $_.Name -notlike '*.sig' } |
      Select-Object -First 1
  }

  if (-not $setupExe) {
    throw "Instalador NSIS (.exe) não encontrado em $NsisDir"
  }

  $sigPath = "$($setupExe.FullName).sig"
  if (-not (Test-Path $sigPath)) {
    throw "Assinatura não encontrada: $sigPath (build sem TAURI_SIGNING_PRIVATE_KEY?)"
  }

  $signature = (Get-Content -Raw -Path $sigPath).Trim()
  $assetName = $setupExe.Name
  $encodedName = [Uri]::EscapeDataString($assetName)
  $downloadUrl = "https://github.com/$Repo/releases/download/$Tag/$encodedName"

  if (-not $Notes) {
    $Notes = "Easy Start v$Version"
  }

  $manifest = [ordered]@{
    version   = $Version
    notes     = $Notes
    pub_date  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    platforms = [ordered]@{
      'windows-x86_64' = [ordered]@{
        signature = $signature
        url       = $downloadUrl
      }
    }
  }

  $jsonPath = Join-Path $NsisDir 'latest.json'
  $json = $manifest | ConvertTo-Json -Depth 6
  Write-TextFile $jsonPath $json

  Write-Host "  latest.json gerado ($assetName)" -ForegroundColor DarkGray
  return $jsonPath
}

function Ensure-UpdaterLatestJson {
  param(
    [string] $NsisDir,
    [string] $Version,
    [string] $Tag,
    [string] $Repo,
    [string] $Notes = ''
  )

  $existing = Join-Path $NsisDir 'latest.json'
  if (Test-Path $existing) {
    return $existing
  }

  return Write-UpdaterLatestJson -NsisDir $NsisDir -Version $Version -Tag $Tag -Repo $Repo -Notes $Notes
}

function Get-NsisSetupExe([string] $nsisDir) {
  $setupExe = Get-ChildItem -Path $nsisDir -File -Filter '*setup.exe' |
    Where-Object { $_.Extension -eq '.exe' } |
    Select-Object -First 1
  if (-not $setupExe) {
    $setupExe = Get-ChildItem -Path $nsisDir -File -Filter '*.exe' |
      Where-Object { $_.Name -notlike '*.sig' } |
      Select-Object -First 1
  }
  return $setupExe
}

function Get-VersionFromSetupExe([System.IO.FileInfo] $setupExe) {
  if ($setupExe.Name -match '_(\d+\.\d+\.\d+)(?:[\-.][0-9A-Za-z\-.]+)?(?:\+[0-9A-Za-z\-.]+)?_') {
    return Assert-SemVer $Matches[1]
  }
  throw "Não foi possível ler a versão do nome do instalador: $($setupExe.Name)"
}

function Assert-SignedBuildArtifacts([string] $nsisDir, [string] $Version) {
  $setupExe = Get-NsisSetupExe $nsisDir
  if (-not $setupExe) {
    throw @"
Instalador .exe não encontrado em $nsisDir
Rode antes: npm run tauri:build:release
"@
  }

  $sigPath = "$($setupExe.FullName).sig"
  if (-not (Test-Path $sigPath)) {
    throw @"
Assinatura ausente: $sigPath
Rode o build assinado: npm run tauri:build:release
"@
  }

  $builtVersion = Get-VersionFromSetupExe $setupExe
  if ($builtVersion -ne $Version) {
    throw @"
Versão do instalador ($builtVersion) diferente da versão da release ($Version).
Rode npm run tauri:build:release com a mesma versão dos arquivos do projeto.
"@
  }

  return $setupExe
}

function Get-ReleaseArtifacts([string] $nsisDir) {
  $files = Get-ChildItem -Path $nsisDir -File -ErrorAction SilentlyContinue
  if (-not $files) {
    throw "Nenhum arquivo em $nsisDir"
  }

  $artifacts = [System.Collections.Generic.List[string]]::new()
  foreach ($f in $files) {
    if ($f.Name -eq 'latest.json') {
      $artifacts.Add($f.FullName)
      continue
    }
    if ($f.Extension -eq '.sig') {
      $artifacts.Add($f.FullName)
      continue
    }
    if ($f.Extension -eq '.exe' -and $f.Name -notlike '*.sig') {
      $artifacts.Add($f.FullName)
    }
  }

  if (-not ($artifacts | Where-Object { $_ -like '*latest.json' })) {
    throw "latest.json ausente em $nsisDir (será gerado antes do upload)."
  }
  if (-not ($artifacts | Where-Object { $_ -like '*.exe' })) {
    throw "Instalador .exe ausente em $nsisDir"
  }
  if (-not ($artifacts | Where-Object { $_ -like '*.sig' })) {
    throw "Arquivo .sig ausente em $nsisDir. Use: npm run tauri:build:release"
  }

  return $artifacts
}

function Invoke-ReleaseGitFlow {
  param(
    [string] $Version,
    [string] $ReleaseBranch,
    [switch] $DoPush
  )

  $sourceBranch = git branch --show-current
  if (-not $sourceBranch) {
    throw 'Não foi possível identificar a branch atual (HEAD detached?).'
  }

  $existing = git branch --list $ReleaseBranch
  if ($existing) {
    throw "A branch '$ReleaseBranch' já existe. Apague-a ou use -BranchName com outro nome."
  }

  $pending = git status --porcelain
  if ($pending) {
    Write-Host "  Alterações a commitar em '$sourceBranch':" -ForegroundColor DarkGray
    Write-Host $pending
    git add -A
    git commit -m "chore(release): v$Version"
    Write-Host "  Commit criado em $sourceBranch." -ForegroundColor Green
  } else {
    Write-Host "  Working tree limpo em $sourceBranch (sem novo commit)." -ForegroundColor Yellow
  }

  if ($DoPush) {
    Write-Host "  git push origin $sourceBranch ..."
    git push origin $sourceBranch
    if ($LASTEXITCODE -ne 0) {
      throw "Falha no push de $sourceBranch"
    }
  }

  Write-Host "  Criando branch '$ReleaseBranch' ..."
  git checkout -b $ReleaseBranch
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao criar branch $ReleaseBranch"
  }

  if ($DoPush) {
    Write-Host "  git push -u origin $ReleaseBranch ..."
    git push -u origin $ReleaseBranch
    if ($LASTEXITCODE -ne 0) {
      throw "Falha no push de $ReleaseBranch"
    }
  }

  Write-Host "  Voltando para '$sourceBranch' ..."
  git checkout $sourceBranch
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao voltar para $sourceBranch"
  }

  return @{
    SourceBranch  = $sourceBranch
    ReleaseBranch = $ReleaseBranch
  }
}

# --- início ---

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

Assert-Command 'git' 'Instale Git.'
Assert-Command 'gh' 'Instale: winget install GitHub.cli e rode gh auth login'

$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI não autenticado. Rode: gh auth login"
}

$hasSignedBuild = $false
$nsisDirEarly = Join-Path $repoRoot 'src-tauri/target/release/bundle/nsis'
if ((Test-Path $nsisDirEarly) -and (Get-NsisSetupExe $nsisDirEarly) -and (Test-Path "$(Get-NsisSetupExe $nsisDirEarly).sig")) {
  $hasSignedBuild = $true
}

# Após o build: versão vem do instalador, não incrementa de novo.
if ($hasSignedBuild -and -not $VersionOnly -and -not $Version) {
  $SkipVersionBump = $true
}

$resolved = Resolve-NextReleaseVersion -Repo $Repo -RepoRoot $repoRoot -ExplicitVersion $Version -BumpKind $Bump -SkipVersionBump:$SkipVersionBump
$Version = $resolved.Version
$versionSource = $resolved.Source

if ($hasSignedBuild -and -not $VersionOnly) {
  $builtVersion = Get-VersionFromSetupExe (Get-NsisSetupExe $nsisDirEarly)
  if ($Version -ne $builtVersion) {
    Write-Host "Versão do build: $builtVersion (instalador em nsis/)" -ForegroundColor Cyan
    $Version = $builtVersion
    $versionSource = 'instalador buildado (npm run tauri:build:release)'
  }
}

if (-not $BranchName) {
  $BranchName = "release/$Version"
}

if ($VersionOnly) {
  if ($hasSignedBuild -and -not $SkipVersionBump) {
    Write-Warning 'Já existe build em nsis/. -VersionOnly só altera arquivos; rode tauri:build:release de novo se mudar a versão.'
  }
  if (-not $SkipVersionBump) {
    Write-Host "Atualizando versão para $Version ..." -ForegroundColor Cyan
    Set-ProjectVersion $repoRoot $Version
  }
  Write-Host ''
  Write-Host 'Versão definida nos arquivos.' -ForegroundColor Green
  Write-Host 'Próximo passo:'
  Write-Host '  npm run tauri:build:release'
  Write-Host '  npm run release:local'
  exit 0
}

if (-not $hasSignedBuild) {
  throw @"
Build assinado não encontrado em src-tauri/target/release/bundle/nsis/

Ordem:
  1. npm run tauri:build:release
  2. npm run release:local

(Se ainda não definiu a versão: npm run release:local -- -VersionOnly)
"@
}

if ($DryRun) {
  Write-Host ''
  Write-Host "Dry-run: versão detectada = $Version" -ForegroundColor Green
  Write-Host "         tag = easy-start-v$Version"
  Write-Host "         branch = $BranchName"
  Write-Host "         origem: $versionSource"
  exit 0
}

if ($Confirm) {
  Write-Host ''
  Write-Host "Versão $Version ($versionSource)." -ForegroundColor Yellow
  Write-Host 'Publicará release no GitHub (git + assets do build).'
  $answer = Read-Host 'Continuar? [S/n]'
  if ($answer -match '^[nN]') {
    Write-Host 'Cancelado.'
    exit 0
  }
}

$tag = "easy-start-v$Version"
$releaseTitle = "Easy Start v$Version"
$manifestUrl = 'https://github.com/vssoares/easy-start/releases/latest/download/latest.json'

Write-Host ''
Write-Host "=== Release local: v$Version ($tag) ===" -ForegroundColor Cyan
Write-Host "    Origem: $versionSource" -ForegroundColor DarkGray
Write-Host ''

$step = 1
$totalSteps = 4

if (-not $SkipVersionBump) {
  Write-Host "[$step/$totalSteps] Atualizando versão nos arquivos ..." -ForegroundColor Cyan
  Set-ProjectVersion $repoRoot $Version
  $step++
} else {
  Write-Host "[$step/$totalSteps] Versão da release: $Version ($versionSource)" -ForegroundColor Cyan
  $confVersion = Get-CurrentProjectVersion $repoRoot
  if ($confVersion -ne $Version) {
    Write-Warning "tauri.conf.json está em $confVersion; o instalador buildado é $Version."
  }
  $step++
}

if (-not $SkipGit) {
  Write-Host "[$step/$totalSteps] Git: commit, branch $BranchName, volta à branch anterior ..." -ForegroundColor Cyan
  $gitResult = Invoke-ReleaseGitFlow -Version $Version -ReleaseBranch $BranchName -DoPush:$Push
  Write-Host "  Branch principal: $($gitResult.SourceBranch)" -ForegroundColor DarkGray
  Write-Host "  Branch release:  $($gitResult.ReleaseBranch)" -ForegroundColor DarkGray
  $step++
} else {
  Write-Host "[$step/$totalSteps] Git ignorado (-SkipGit)." -ForegroundColor Yellow
  $step++
}

Write-Host "[$step/$totalSteps] Artefatos do build assinado ..." -ForegroundColor Cyan
$nsisDir = Find-NsisBundleDir $repoRoot
Assert-SignedBuildArtifacts -NsisDir $nsisDir -Version $Version | Out-Null

Write-Host '  Gerando latest.json ...' -ForegroundColor DarkGray
$releaseNotes = if ($Notes) { $Notes } else { "Easy Start v$Version" }
Ensure-UpdaterLatestJson -NsisDir $nsisDir -Version $Version -Tag $tag -Repo $Repo -Notes $releaseNotes | Out-Null

$artifactPaths = Get-ReleaseArtifacts $nsisDir
Write-Host "  $($artifactPaths.Count) arquivo(s) em $nsisDir" -ForegroundColor DarkGray
$step++

Write-Host "[$step/$totalSteps] Publicando no GitHub ..." -ForegroundColor Cyan

$releaseExists = $false
gh release view $tag --repo $Repo 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  $releaseExists = $true
}

if ($releaseExists -and $Force) {
  Write-Host "  Removendo release existente $tag (-Force) ..." -ForegroundColor Yellow
  gh release delete $tag --repo $Repo --yes --cleanup-tag
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao apagar release $tag"
  }
  $releaseExists = $false
}

if (-not $releaseExists) {
  if (-not $Notes) {
    $Notes = @"
Instalador Windows e atualização automática para esta versão.

Baixe o instalador ``.exe`` nos assets abaixo.
O manifesto de atualização: $manifestUrl
"@
  }

  $targetRef = git rev-parse HEAD
  gh release create $tag `
    --repo $Repo `
    --title $releaseTitle `
    --notes $Notes `
    --target $targetRef
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao criar release $tag"
  }
  Write-Host "  Release criado: $tag" -ForegroundColor Green
} else {
  Write-Host "  Release $tag já existe; enviando assets (--clobber)." -ForegroundColor Yellow
}

gh release upload $tag @artifactPaths --repo $Repo --clobber
if ($LASTEXITCODE -ne 0) {
  throw 'Falha ao enviar assets para o GitHub.'
}
Write-Host '  Assets enviados.' -ForegroundColor Green

Write-Host 'Verificação do manifesto ...' -ForegroundColor Cyan
if (-not $SkipVerify) {
  $verified = $false
  $verifyScript = Join-Path $PSScriptRoot 'verify-update-manifest.ps1'
  for ($i = 1; $i -le 6; $i++) {
    & $verifyScript
    if ($LASTEXITCODE -eq 0) {
      $verified = $true
      break
    }
    if ($i -lt 6) {
      Write-Host "  Tentativa $i/6 falhou; aguardando 10s ..." -ForegroundColor Yellow
      Start-Sleep -Seconds 10
    }
  }
  if (-not $verified) {
    Write-Warning 'Manifesto ainda não acessível via /latest/download/. O release pode estar OK; tente de novo em alguns minutos.'
    Write-Host "  .\scripts\verify-update-manifest.ps1"
  }
} else {
  Write-Host '  Verificação ignorada (-SkipVerify).' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '=== Release publicada ===' -ForegroundColor Green
Write-Host "  Tag:       $tag"
Write-Host "  Versão:    $Version"
Write-Host "  Branch:    $BranchName"
Write-Host "  Release:   https://github.com/$Repo/releases/tag/$tag"
Write-Host "  Updater:   $manifestUrl"
Write-Host ''
if (-not $Push -and -not $SkipGit) {
  Write-Host 'Dica: use -Push para enviar main e release/* ao remoto.' -ForegroundColor DarkGray
}
