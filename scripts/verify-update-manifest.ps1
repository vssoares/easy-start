# Verifica se o manifesto de atualização do Tauri está acessível no GitHub.
param(
  [string] $Url = 'https://github.com/vssoares/easy-start/releases/latest/download/latest.json'
)

$ErrorActionPreference = 'Stop'

Write-Host "Verificando: $Url" -ForegroundColor Cyan

try {
  $response = Invoke-WebRequest -Uri $Url -UseBasicParsing
  Write-Host "OK ($($response.StatusCode))" -ForegroundColor Green
  $json = $response.Content | ConvertFrom-Json
  Write-Host "Versão no manifesto: $($json.version)"
  if ($json.platforms.'windows-x86_64') {
    Write-Host "windows-x86_64: $($json.platforms.'windows-x86_64'.url)"
  } else {
    Write-Warning 'Plataforma windows-x86_64 não encontrada no latest.json'
  }
} catch {
  Write-Host 'FALHOU — o app instalado não conseguirá detectar atualização.' -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host ''
  Write-Host 'Checklist:' -ForegroundColor Yellow
  Write-Host '  1. O release no GitHub está PUBLICADO (não rascunho)?'
  Write-Host '  2. O asset latest.json existe no release?'
  Write-Host '  3. O workflow rodou com TAURI_SIGNING_PRIVATE_KEY configurado?'
  Write-Host '  4. A versão no manifesto é maior que a instalada?'
  exit 1
}
