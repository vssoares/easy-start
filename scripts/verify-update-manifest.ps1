# Verifica se o manifesto de atualização está acessível (URL usada pelo app).
param(
  [string] $Url = 'https://github.com/vssoares/easy-start/releases/latest/download/latest.json'
)

$ErrorActionPreference = 'Stop'

Write-Host "Verificando: $Url" -ForegroundColor Cyan
try {
  $response = Invoke-WebRequest -Uri $Url -UseBasicParsing
  Write-Host "  OK ($($response.StatusCode))" -ForegroundColor Green
  $json = $response.Content | ConvertFrom-Json
  Write-Host "  Versão: $($json.version)"
  if ($json.platforms.'windows-x86_64') {
    Write-Host "  windows-x86_64: $($json.platforms.'windows-x86_64'.url)"
  }
} catch {
  Write-Host ''
  Write-Host 'Manifesto inacessível — o app mostrará "Falha ao verificar".' -ForegroundColor Red
  Write-Host ''
  Write-Host 'Como corrigir:' -ForegroundColor Yellow
  Write-Host '  1. Rode o workflow Release (com TAURI_SIGNING_PRIVATE_KEY)'
  Write-Host '  2. Publique o release no GitHub (não rascunho) com asset latest.json'
  Write-Host "  3. Teste: $Url"
  exit 1
}

Write-Host ''
Write-Host 'Updater deve funcionar no app instalado (.exe de produção).' -ForegroundColor Green
