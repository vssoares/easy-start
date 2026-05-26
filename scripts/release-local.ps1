# Build local (Tauri + assinatura) e publica release no GitHub.
#
# Uso:
#   .\scripts\release-local.ps1              # detecta próxima versão (patch)
#   .\scripts\release-local.ps1 1.1.4        # versão explícita
#   npm run release:local
#   npm run release:local -- -Bump minor
#
# Opções:
#   -Bump patch|minor|major   Incremento quando a versão é detectada (padrão: patch)
#   -Confirm                  Pede confirmação antes de build/publicar
#   -DryRun                   Só mostra qual versão seria usada (não builda nem publica)
#   -SkipVersionBump          Usa a versão já em tauri.conf.json (não altera arquivos)
#   -SkipCommit               Não faz commit git
#   -SkipBuild                Só publica artefatos já gerados em src-tauri/target/...
#   -SkipVerify               Não testa a URL do latest.json após publicar
#   -Force                    Apaga e recria o release/tag se já existir
#   -Push                     Faz push da branch atual após o commit
#   -Notes "texto"            Notas customizadas do release

param(
  [Parameter(Mandatory = $false, Position = 0)]
  [string] $Version = '',

  [ValidateSet('patch', 'minor', 'major')]
  [string] $Bump = 'patch',

  [string] $Repo = 'vssoares/easy-start',
  [string] $KeyPath = '',
  [switch] $SkipVersionBump,
  [switch] $SkipCommit,
  [switch] $SkipBuild,
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

function Set-TauriSigningEnv([string] $privateKeyPath) {
  # Chaves --ci são "criptografadas com senha vazia": sem PASSWORD="" e --ci no build, o Tauri pede senha no prompt.
  foreach ($name in @(
      'TAURI_SIGNING_PRIVATE_KEY',
      'TAURI_PRIVATE_KEY',
      'TAURI_PRIVATE_KEY_PATH',
      'TAURI_PRIVATE_KEY_PASSWORD'
    )) {
    Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
  }

  $resolved = (Resolve-Path $privateKeyPath).Path
  $env:TAURI_SIGNING_PRIVATE_KEY_PATH = $resolved
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
}

function Find-NsisBundleDir([string] $repoRoot) {
  $base = Join-Path $repoRoot 'src-tauri/target/release/bundle/nsis'
  if (-not (Test-Path $base)) {
    throw "Pasta de build não encontrada: $base`nRode o build ou remova -SkipBuild."
  }
  return (Resolve-Path $base).Path
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
    throw "latest.json ausente em $nsisDir. Defina TAURI_SIGNING_PRIVATE_KEY antes do build."
  }
  if (-not ($artifacts | Where-Object { $_ -like '*.exe' })) {
    throw "Instalador .exe ausente em $nsisDir"
  }

  return $artifacts
}

# --- início ---

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

Assert-Command 'git' 'Instale Git.'
Assert-Command 'npm' 'Instale Node.js 22+.'
Assert-Command 'gh' 'Instale: winget install GitHub.cli e rode gh auth login'

$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI não autenticado. Rode: gh auth login"
}

if (-not $KeyPath) {
  $KeyPath = Join-Path $env:USERPROFILE '.tauri\easy-start.key'
}

$resolved = Resolve-NextReleaseVersion -Repo $Repo -RepoRoot $repoRoot -ExplicitVersion $Version -BumpKind $Bump -SkipVersionBump:$SkipVersionBump
$Version = $resolved.Version
$versionSource = $resolved.Source

if ($DryRun) {
  Write-Host ''
  Write-Host "Dry-run: versão detectada = $Version" -ForegroundColor Green
  Write-Host "         tag = easy-start-v$Version"
  Write-Host "         origem: $versionSource"
  exit 0
}

if ($Confirm) {
  Write-Host ''
  Write-Host "Será publicada a versão $Version ($versionSource)." -ForegroundColor Yellow
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

if (-not $SkipVersionBump) {
  Write-Host '[1/5] Atualizando versão nos arquivos do projeto ...' -ForegroundColor Cyan
  Set-ProjectVersion $repoRoot $Version
} else {
  Write-Host '[1/5] Versão nos arquivos (sem alteração):' (Get-CurrentProjectVersion $repoRoot) -ForegroundColor Cyan
}

if (-not $SkipCommit) {
  Write-Host '[2/5] Commit git ...' -ForegroundColor Cyan
  $pending = git status --porcelain
  if ($pending) {
    git add -A
    git commit -m "chore(release): v$Version"
    Write-Host "  Commit criado." -ForegroundColor Green
  } else {
    Write-Host '  Nada para commitar (working tree limpo).' -ForegroundColor Yellow
  }
} else {
  Write-Host '[2/5] Commit git ignorado (-SkipCommit).' -ForegroundColor Yellow
}

if (-not $SkipBuild) {
  Write-Host '[3/5] Build Tauri (NSIS + updater) ...' -ForegroundColor Cyan
  if (-not (Test-Path $KeyPath)) {
    throw @"
Chave de assinatura não encontrada: $KeyPath
Gere com: npm run tauri signer generate -- -w `"$KeyPath`" --ci
"@
  }

  Set-TauriSigningEnv $KeyPath

  npm run tauri:build -- --config src-tauri/tauri.ci.conf.json --ci
  if ($LASTEXITCODE -ne 0) {
    throw 'Build Tauri falhou.'
  }
  Write-Host '  Build concluído.' -ForegroundColor Green
} else {
  Write-Host '[3/5] Build ignorado (-SkipBuild).' -ForegroundColor Yellow
}

$nsisDir = Find-NsisBundleDir $repoRoot
$artifactPaths = Get-ReleaseArtifacts $nsisDir
Write-Host "  Artefatos: $($artifactPaths.Count) arquivo(s) em $nsisDir" -ForegroundColor DarkGray

Write-Host '[4/5] Publicando no GitHub ...' -ForegroundColor Cyan

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

if ($Push) {
  $branch = git branch --show-current
  if (-not $branch) {
    Write-Warning 'Push ignorado: HEAD detached.'
  } else {
    Write-Host "  git push origin $branch ..." -ForegroundColor DarkGray
    git push origin $branch
    if ($LASTEXITCODE -ne 0) {
      throw "Falha no push para origin/$branch"
    }
  }
}

Write-Host '[5/5] Verificação do manifesto ...' -ForegroundColor Cyan
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
Write-Host "  Release:   https://github.com/$Repo/releases/tag/$tag"
Write-Host "  Updater:   $manifestUrl"
Write-Host ''
if (-not $Push -and -not $SkipCommit) {
  Write-Host 'Dica: use -Push para enviar o commit ao remoto (evite push em release/* se o Actions também publica).' -ForegroundColor DarkGray
}
