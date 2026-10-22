# Easy Start

Launcher desktop no estilo biblioteca (ExitLag), com **Angular 22**, **Tailwind CSS 4** e **Electron**. Instala programas via winget, gerencia versões do Node (NVM), monitores, portas e mostra informações do sistema (somente Windows).

## Requisitos

- Node.js **22.22.3+** (Angular 22 RC exige essa versão mínima)
- Windows 10 ou superior

```bash
nvm install 22.22.3
nvm use 22.22.3
npm install
```

## Desenvolvimento

### Apenas web (navegador)

```bash
npm start
```

Abre em `http://localhost:4200`. Os comandos nativos (winget, NVM, monitores…) só funcionam dentro do Electron.

### Desktop (Electron)

```bash
npm run dev
```

Sobe o `ng serve` (recarrega o Angular ao salvar), compila o processo principal (`electron/`) em modo watch e abre o Electron em `http://localhost:4200`. Ao salvar qualquer arquivo em `electron/`, o Electron reinicia sozinho. Fechar a janela encerra tudo. Argumentos extras vão para o Electron (ex.: `npm run dev -- --user-data-dir=...`).

## Build de produção

```bash
npm run dist:win
```

O instalador (`EasyStart-Setup-<versão>.exe`), o `.blockmap` e o `latest.yml` ficam em `release/`.

## Releases e atualização automática

O app usa `electron-updater` com **GitHub Releases** (`vssoares/easy-start`).

### Publicar uma nova versão (GitHub Actions — recomendado)

```bash
npm version patch   # ou minor / major — atualiza o package.json e cria a tag vX.Y.Z
git push && git push --tags
```

O workflow `.github/workflows/release.yml` roda ao detectar uma tag `vX.Y.Z`: confere se a tag bate com a versão do `package.json`, faz o build e publica o release com `.exe`, `.blockmap` e `latest.yml`.

### Publicar direto da sua máquina

```powershell
$env:GH_TOKEN = "<personal access token com escopo repo>"
npm version patch
npm run dist:win:publish
git push && git push --tags
```

O token precisa do escopo `repo`; é assim que o `electron-builder` autentica para criar o release.

### Como o update funciona no app

1. Ao abrir, o app consulta o último release publicado no GitHub.
2. Se a versão for maior que a instalada, aparece o botão **Atualizar para vX.Y.Z** na barra superior.
3. Ao clicar, o instalador é baixado (com progresso), instalado em modo silencioso e o app reabre sozinho.

### O updater não aparece?

1. **Release em rascunho** — só releases **publicados** são vistos pelo updater.
2. **Falta o `latest.yml`** no release — ele é gerado pelo `electron-builder` e precisa estar entre os assets.
3. **Versão igual ou menor** — o app só oferece update se a versão no GitHub for **maior** que a instalada.
4. **App em dev** (`npm run dev`) — a checagem é ignorada; teste com o instalador de produção.

### Migrando da versão Tauri

As versões `≤ 1.2.0` eram Tauri e usavam outro mecanismo de update (`latest.json`). Elas **não** atualizam sozinhas para a versão Electron: instale o primeiro `EasyStart-Setup-*.exe` manualmente (e desinstale a versão antiga). A partir daí, os updates são automáticos.

## Estrutura

- `src/app/` — interface Angular (`layout/`, `pages/`, `components/`, `services/`)
- `src/app/core/desktop.ts` — ponte do renderer com o Electron (`invoke`, `listen`)
- `electron/main.ts` — janela, protocolo `app://`, auto-update
- `electron/preload.ts` — API segura exposta como `window.desktop`
- `electron/commands/` — comandos nativos (install, nvm, port, monitors, quick-tools, system-info)
- `electron/native/monitors.ps1` — chamadas Win32 (`SetDisplayConfig`) compiladas via PowerShell
- `scripts/build-electron.mjs` — bundle do main/preload com esbuild
- `build/` — ícones do instalador

## Funcionalidades da UI

- Tema escuro com destaque vermelho `#e8192c`
- Barra lateral com navegação e indicador ativo
- Busca na biblioteca, filtros e índice alfabético A–Z
- Controles de janela customizados (minimizar, maximizar, fechar)
- Toast “Avalie sua conexão”
