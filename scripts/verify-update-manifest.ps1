# Verifica se o manifesto de atualização está acessível (URLs usadas pelo app).
param(
  [string[]] $Urls = @(
    'https://vssoares.github.io/easy-start/latest.json',
    'https://github.com/vssoares/easy-start/releases/latest/download/latest.json'
  )
)

$ErrorActionPreference = 'Continue'
$ok = $false

foreach ($url in $Urls) {
  Write-Host "Verificando: $url" -ForegroundColor Cyan
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing
    Write-Host "  OK ($($response.StatusCode))" -ForegroundColor Green
    $json = $response.Content | ConvertFrom-Json
    Write-Host "  Versão: $($json.version)"
    if ($json.platforms.'windows-x86_64') {
      Write-Host "  windows-x86_64: $($json.platforms.'windows-x86_64'.url)"
    }
    $ok = $true
    break
  } catch {
    Write-Host "  Falhou: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

if (-not $ok) {
  Write-Host ''
  Write-Host 'Nenhum endpoint respondeu — o app mostrará "Falha ao verificar".' -ForegroundColor Red
  Write-Host ''
  Write-Host 'Como corrigir:' -ForegroundColor Yellow
  Write-Host '  1. Rode o workflow Release (com TAURI_SIGNING_PRIVATE_KEY)'
  Write-Host '  2. Publique o release no GitHub (não rascunho) com asset latest.json'
  Write-Host '  3. Em github.com/vssoares/easy-start → Settings → Pages → source: branch gh-pages'
  Write-Host '  4. Se o repositório for privado, o Pages precisa estar público'
  exit 1
}

Write-Host ''
Write-Host 'Updater deve funcionar no app instalado (.exe de produção).' -ForegroundColor Green
