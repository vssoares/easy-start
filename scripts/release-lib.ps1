# Funções compartilhadas pelos scripts de release local.

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
    throw "Versão inválida: '$v'. Use semver, ex.: 1.1.6"
  }
  foreach ($part in @($Matches[1], $Matches[2], $Matches[3])) {
    if ($part.Length -gt 1 -and $part.StartsWith('0')) {
      throw "Versão inválida: '$v'. Sem zeros à esquerda."
    }
  }
  return $v
}

function Set-ProjectVersion([string] $repoRoot, [string] $v) {
  $files = @{
    'src-tauri/tauri.conf.json' = { param($c, $ver) $c -replace '("version"\s*:\s*")[^"]+(")', "`${1}$ver`${2}" }
    'package.json'              = { param($c, $ver) $c -replace '("version"\s*:\s*")[^"]+(")', "`${1}$ver`${2}" }
    'package-lock.json'         = {
      param($c, $ver)
      [regex]::Replace($c, '"name": "easy-start",\s*"version": "[^"]+"', "`"name`": `"easy-start`", `"version`": `"$ver`"")
    }
    'src-tauri/Cargo.toml'      = { param($c, $ver) $c -replace '(?m)^version\s*=\s*"[^"]+"', "version = `"$ver`"" }
  }

  foreach ($relPath in $files.Keys) {
    $path = Join-Path $repoRoot $relPath
    if (-not (Test-Path $path)) {
      Write-Warning "Arquivo não encontrado: $relPath"
      continue
    }
    $content = Read-TextFile $path
    $updated = & $files[$relPath] $content $v
    if ($content -eq $updated) {
      Write-Warning "Sem alteração em $relPath"
    }
    Write-TextFile $path $updated
  }
}

function Get-NsisSetupExe([string] $nsisDir) {
  if (-not (Test-Path $nsisDir)) { return $null }
  $exe = Get-ChildItem -Path $nsisDir -File -Filter '*setup.exe' | Select-Object -First 1
  if (-not $exe) {
    $exe = Get-ChildItem -Path $nsisDir -File -Filter '*.exe' |
      Where-Object { $_.Name -notlike '*.sig' } | Select-Object -First 1
  }
  return $exe
}

function Assert-SignedBuild([string] $repoRoot, [string] $version) {
  $nsisDir = Join-Path $repoRoot 'src-tauri/target/release/bundle/nsis'
  if (-not (Test-Path $nsisDir)) {
    throw "Build não encontrado. Rode: npm run tauri:build:release"
  }

  $exe = Get-NsisSetupExe $nsisDir
  if (-not $exe) {
    throw "Instalador .exe não encontrado em $nsisDir"
  }
  if (-not (Test-Path "$($exe.FullName).sig")) {
    throw "Assinatura .sig ausente. Rode: npm run tauri:build:release"
  }
  if ($exe.Name -notmatch "_$([regex]::Escape($version))_") {
    throw "Instalador ($($exe.Name)) não corresponde à versão $version."
  }

  return (Resolve-Path $nsisDir).Path
}

function Write-LatestJson {
  param(
    [string] $NsisDir,
    [string] $Version,
    [string] $Tag,
    [string] $Repo,
    [string] $Notes,
    [string] $DownloadUrl = ''
  )

  $exe = Get-NsisSetupExe $NsisDir
  $signature = (Get-Content -Raw "$($exe.FullName).sig").Trim()
  if (-not $DownloadUrl) {
    # GitHub troca espaços por pontos no nome do asset; URL com %20 quebra o download.
    $assetName = $exe.Name -replace ' ', '.'
    $DownloadUrl = "https://github.com/$Repo/releases/download/$Tag/$([Uri]::EscapeDataString($assetName))"
  }

  $manifest = [ordered]@{
    version   = $Version
    notes     = if ($Notes) { $Notes } else { "Easy Start v$Version" }
    pub_date  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    platforms = [ordered]@{
      'windows-x86_64' = [ordered]@{
        signature = $signature
        url       = $DownloadUrl
      }
    }
  }

  $path = Join-Path $NsisDir 'latest.json'
  Write-TextFile $path ($manifest | ConvertTo-Json -Depth 6)
  return $path
}

function Sync-LatestJsonFromGhRelease {
  param([string] $NsisDir, [string] $Version, [string] $Tag, [string] $Repo, [string] $Notes)

  $release = gh release view $Tag --repo $Repo --json assets | ConvertFrom-Json
  $exeAsset = $release.assets |
    Where-Object { $_.name -like '*setup.exe' -and $_.name -notlike '*.sig' } |
    Select-Object -First 1

  if (-not $exeAsset) {
    throw "Asset do instalador não encontrado no release $Tag. Faça upload do .exe antes."
  }

  return Write-LatestJson -NsisDir $NsisDir -Version $Version -Tag $Tag -Repo $Repo -Notes $Notes `
    -DownloadUrl $exeAsset.url
}

function Get-UploadArtifacts([string] $nsisDir) {
  $list = [System.Collections.Generic.List[string]]::new()
  foreach ($f in (Get-ChildItem -Path $nsisDir -File)) {
    if ($f.Name -eq 'latest.json' -or $f.Extension -eq '.sig' -or ($f.Extension -eq '.exe' -and $f.Name -notlike '*.sig')) {
      $list.Add($f.FullName)
    }
  }
  if ($list.Count -lt 3) {
    throw "Artefatos incompletos em $nsisDir (esperado: .exe, .sig, latest.json)"
  }
  return $list
}

function Test-GhRelease {
  param([string] $Tag, [string] $Repo)

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  $null = gh release view $Tag --repo $Repo 2>&1
  $ok = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $prevEap
  return $ok
}

function Invoke-ReleaseGit {
  param([string] $Version, [string] $ReleaseBranch, [switch] $DoPush)

  if (git branch --list $ReleaseBranch) {
    throw "Branch '$ReleaseBranch' já existe."
  }

  $onBranch = git branch --show-current
  if (-not $onBranch) { throw 'HEAD detached; checkout em main antes de continuar.' }

  git add -A
  $status = git status --porcelain
  if ($status) {
    git commit -m "chore(release): v$Version"
    Write-Host "  Commit em $onBranch" -ForegroundColor Green
  } else {
    Write-Host '  Nada para commitar.' -ForegroundColor Yellow
  }

  if ($DoPush) {
    git push origin $onBranch
    if ($LASTEXITCODE -ne 0) { throw "Falha no push de $onBranch" }
  }

  git checkout -b $ReleaseBranch
  if ($LASTEXITCODE -ne 0) { throw "Falha ao criar $ReleaseBranch" }

  if ($DoPush) {
    git push -u origin $ReleaseBranch
    if ($LASTEXITCODE -ne 0) { throw "Falha no push de $ReleaseBranch" }
  }

  $back = if (git branch --list main) { 'main' } else { $onBranch }
  git checkout $back
  if ($LASTEXITCODE -ne 0) { throw "Falha ao voltar para $back" }
  if ($back -eq 'main') {
    Write-Host '  Voltou para main' -ForegroundColor Green
  } else {
    Write-Warning "Branch main não encontrada; voltou para $back"
  }
}
