# Prepara uma release: atualiza versões, commita na branch atual e cria a branch de release.
#
# Uso:
#   .\scripts\prepare-release.ps1 1.0.1
#   .\scripts\prepare-release.ps1 -Version 1.0.1
#   .\scripts\prepare-release.ps1 v1.0.1 -BranchName release/1.0.1

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Version,

  [string] $BranchName = ''
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

$Version = $Version.Trim().TrimStart('v')
if ($Version -notmatch '^(\d+)\.(\d+)\.(\d+)([\-.][0-9A-Za-z\-.]+)?(\+[0-9A-Za-z\-.]+)?$') {
  Write-Error "Versão inválida: '$Version'. Use semver, ex.: 1.0.2"
}
$major, $minor, $patch = $Matches[1], $Matches[2], $Matches[3]
foreach ($part in @($major, $minor, $patch)) {
  if ($part.Length -gt 1 -and $part.StartsWith('0')) {
    Write-Error "Versão inválida: '$Version'. Sem zeros à esquerda (use 1.0.2, não 1.0.02)."
  }
}

if (-not $BranchName) {
  $BranchName = "release/$Version"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error 'Git não encontrado no PATH.'
}

$sourceBranch = git branch --show-current
if (-not $sourceBranch) {
  Write-Error 'Não foi possível identificar a branch atual (repositório detached HEAD?).'
}

$existing = git branch --list $BranchName
if ($existing) {
  Write-Error "A branch '$BranchName' já existe. Escolha outro nome com -BranchName ou apague a branch local."
}

$pending = git status --porcelain
if ($pending) {
  Write-Host "Alterações pendentes em '$sourceBranch' serão incluídas no commit de release:" -ForegroundColor Yellow
  Write-Host $pending
  Write-Host ''
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

Write-Host "Atualizando versão para $Version em '$sourceBranch' ..."
foreach ($relPath in $files.Keys) {
  $path = Join-Path $repoRoot $relPath
  if (-not (Test-Path $path)) {
    Write-Warning "Arquivo não encontrado, ignorando: $relPath"
    continue
  }
  $content = Read-TextFile $path
  $updated = & $files[$relPath] $content $Version
  if ($content -eq $updated) {
    Write-Warning "Nenhuma alteração em $relPath (campo version não encontrado?)"
  }
  Write-TextFile $path $updated
}

git add -A
git commit -m "chore(release): v$Version"
git push origin $sourceBranch

Write-Host "Criando branch '$BranchName' a partir de '$sourceBranch' ..."
git checkout -b $BranchName

Write-Host ''
Write-Host 'Release preparada localmente.' -ForegroundColor Green
Write-Host "  Commit em:       $sourceBranch"
Write-Host "  Branch release:  $BranchName (checkout atual)"
Write-Host "  Versão:          $Version"
Write-Host ''
Write-Host 'Próximo passo (manual):'
Write-Host "  git push origin $sourceBranch"
Write-Host "  git push -u origin $BranchName"
Write-Host ''
Write-Host 'Depois no GitHub:'
Write-Host '  - O workflow Release roda ao receber push na branch release ou release/*, ou'
Write-Host '  - Actions → Release → Run workflow'
Write-Host '  - Revise o rascunho do release e publique quando estiver pronto.'
