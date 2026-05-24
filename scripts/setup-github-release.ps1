# Configura permissões do Actions e o secret de assinatura Tauri no repositório easy-start.
# Requer: GitHub CLI autenticado (`gh auth login`)

$ErrorActionPreference = 'Stop'
$repo = 'vssoares/easy-start'
$keyPath = Join-Path $env:USERPROFILE '.tauri\easy-start.key'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error 'Instale o GitHub CLI: winget install GitHub.cli'
}

$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Faça login no GitHub CLI primeiro:'
  Write-Host '  gh auth login'
  exit 1
}

Write-Host "Configurando permissões de workflow (read + write) em $repo ..."
@'
{"enabled":true,"allowed_actions":"all"}
'@ | gh api "repos/$repo/actions/permissions" -X PUT --input -

@'
{"default_workflow_permissions":"write","can_approve_pull_request_reviews":true}
'@ | gh api "repos/$repo/actions/permissions/workflow" -X PUT --input -

if (-not (Test-Path $keyPath)) {
  Write-Error "Chave não encontrada: $keyPath`nGere com: npm run tauri signer generate -- -w `"$keyPath`" --ci"
}

Write-Host 'Criando secret TAURI_SIGNING_PRIVATE_KEY ...'
$keyContent = Get-Content -Raw -Path $keyPath
$keyContent | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $repo

Write-Host 'Chave sem senha — TAURI_SIGNING_PRIVATE_KEY_PASSWORD não é necessário.'
Write-Host 'Concluído.'
