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

**Ordem:** build assinado primeiro; depois **um** `release:local` (git + GitHub).

```powershell
# 0) Opcional: definir próxima versão nos arquivos (antes do build)
npm run release:local -- -VersionOnly
# ou: npm run release:local -- 1.2.0 -VersionOnly

# 1) Build assinado
npm run tauri:build:release

# 2) Commit, branch release/*, volta para main, publica no GitHub
npm run release:local
```

O passo 2 usa a **versão do instalador** em `nsis/` (não incrementa de novo se o build já existe).

| Flag | Efeito |
|------|--------|
| `-VersionOnly` | Só atualiza versão nos arquivos (rode **antes** do build) |
| `-SkipVersionBump` | Não altera arquivos; confia no instalador buildado |
| `-SkipGit` | Só publica no GitHub (sem commit/branch) |
| `-Push` | `git push` de main e `release/*` |
| `-Force` | Recria o release se a tag já existir |
| `-Bump minor` | Com `-VersionOnly`, tipo de incremento |
| `-DryRun` | Mostra qual versão seria usada |

**Build assinado** (chave em `%USERPROFILE%\.tauri\easy-start.key`):

```powershell
npm run tauri:build:release
```

Não use só `npm run tauri:build` — não aplica a chave de assinatura.

Chave ausente:

```powershell
npm run tauri signer generate -- -w "$env:USERPROFILE\.tauri\easy-start.key" --ci --force
```

Depois atualize `plugins.updater.pubkey` em `src-tauri/tauri.conf.json` com o conteúdo de `easy-start.key.pub`.

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
