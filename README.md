# Easy Start

Launcher desktop no estilo biblioteca (ExitLag), com **Angular 22**, **Tailwind CSS 4** e **Tauri 2**.

## Requisitos

- Node.js **22.22.3+** (Angular 22 RC exige essa versão mínima)
- Rust + Cargo (para Tauri)

```bash
nvm install 22.22.3
nvm use 22.22.3
```

## Desenvolvimento

### Apenas web (navegador)

```bash
npm install
npm start
```

Abre em `http://localhost:4200`.

### Desktop (Tauri)

```bash
npm run tauri:dev
```

## Build de produção

```bash
npm run tauri:build
```

O instalador fica em `src-tauri/target/release/bundle/`.

## Releases no GitHub

O workflow `.github/workflows/release.yml` publica instaladores e o manifest `latest.json` no **GitHub Release** (`/releases/latest/download/latest.json`) para atualização automática no app.

### Configuração (uma vez)

Com o [GitHub CLI](https://cli.github.com/) autenticado (`gh auth login`):

```powershell
.\scripts\setup-github-release.ps1
```

O script configura permissões **Read and write** do Actions e o secret `TAURI_SIGNING_PRIVATE_KEY` a partir de `%USERPROFILE%\.tauri\easy-start.key`. A chave gerada com `--ci` usa **senha vazia** (o arquivo ainda aparece como "encrypted"); o `release-local.ps1` define `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""` e passa `--ci` no build para não pedir senha no terminal.

### Publicar na sua máquina (recomendado)

Build, assinatura e upload para o GitHub Release — sem depender do Actions:

```powershell
.\scripts\release-local.ps1
# ou: npm run release:local
```

Sem argumento, o script **detecta a próxima versão**: compara `tauri.conf.json` com a última release `easy-start-v*` no GitHub e incrementa o **patch** (ex.: publicada `1.1.3` → publica `1.1.4`). Se os arquivos já estiverem em `1.1.4` e o GitHub ainda em `1.1.3`, usa `1.1.4`.

Versão manual ou outro incremento:

```powershell
.\scripts\release-local.ps1 1.2.0
npm run release:local -- -Bump minor
npm run release:local -- -Confirm
```

O script: atualiza a versão nos arquivos, commita, compila com `TAURI_SIGNING_PRIVATE_KEY` (`%USERPROFILE%\.tauri\easy-start.key`), cria o release `easy-start-v*` e envia `.exe`, `.sig` e `latest.json`.

Opções úteis:

| Flag | Efeito |
|------|--------|
| `-Bump minor` / `major` | Tipo de incremento na detecção automática |
| `-DryRun` | Só mostra qual versão seria usada |
| `-Confirm` | Pede confirmação antes do build |
| `-SkipVersionBump` | Só build/publica com a versão já nos arquivos |
| `-SkipBuild` | Só envia artefatos já gerados |
| `-Force` | Recria o release se a tag já existir |
| `-Push` | Envia o commit para `origin` (cuidado: push em `release/*` dispara o CI também) |

Chave ausente: `npm run tauri signer generate -- -w "%USERPROFILE%\.tauri\easy-start.key" --ci --force`

Se o build pedir `Password:` manualmente, use o script `release-local` (já configura as variáveis) ou no PowerShell:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\easy-start.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
npm run tauri:build -- --config src-tauri/tauri.ci.conf.json --ci
```

### Publicar via GitHub Actions

```powershell
.\scripts\prepare-release.ps1 1.0.1
# ou: npm run release:prepare -- 1.0.1
```

O script atualiza as versões, **commita na branch atual** (ex.: `main`) e em seguida cria a branch `release/1.0.1` apontando para o mesmo commit. O **push** fica com você:

```powershell
git push origin main
git push -u origin release/1.0.1
```

Depois o workflow **Release** roda no push (branch `release` ou `release/*`) **ou** dispare manualmente em **Actions → Release → Run workflow**.

O release é criado **publicado** automaticamente (rascunho impede o updater de funcionar).

### Atualização no app

Com o app instalado, ao abrir a interface verifica o GitHub. Se houver versão mais nova, aparece o botão **Atualizar** na barra superior.

### O updater não aparece?

1. **Release em rascunho** — `https://github.com/vssoares/easy-start/releases/latest/download/latest.json` só funciona em releases **publicados**.
2. **Falta `latest.json`** — o CI precisa do secret `TAURI_SIGNING_PRIVATE_KEY` e `createUpdaterArtifacts: true`.
3. **Versão igual** — o app só oferece update se a versão no GitHub for **maior** que a instalada (ex.: instalado `1.0.6`, release `1.0.7`).
4. **App em dev** (`tauri dev`) — use o instalador `.exe` de produção para testar updates.
5. **Build antigo** — apps já instalados usam o endpoint gravado no instalador; publique uma versão nova com este endpoint para que usuários antigos recebam o update.

Verifique o manifesto:

```powershell
.\scripts\verify-update-manifest.ps1
```

Deve retornar HTTP 200 e a versão nova.

## Estrutura

- `src/app/layout/` — shell, sidebar e topbar
- `src/app/pages/library/` — tela Biblioteca / Programas
- `src/app/components/` — tiles, categorias, índice A–Z, toast
- `src-tauri/` — backend Rust do Tauri

## Funcionalidades da UI

- Tema escuro com destaque vermelho `#e8192c`
- Barra lateral com navegação e indicador ativo
- Busca global (topbar) e busca na biblioteca
- Filtros: Todos, Jogos, Navegador, Voz
- Grade responsiva de programas
- Índice alfabético A–Z
- Controles de janela customizados (minimizar, maximizar, fechar)
- Toast “Avalie sua conexão”
