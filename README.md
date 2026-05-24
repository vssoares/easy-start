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

O workflow `.github/workflows/release.yml` publica instaladores e o manifest `latest.json` para atualização automática no app.

### Configuração (uma vez)

1. No repositório GitHub: **Settings → Actions → General → Workflow permissions** → marque **Read and write permissions**.
2. Crie o secret `TAURI_SIGNING_PRIVATE_KEY` com o conteúdo do arquivo `%USERPROFILE%\.tauri\easy-start.key` (gerado por `npm run tauri signer generate -- -w "%USERPROFILE%\.tauri\easy-start.key" --ci`).
3. Se a chave tiver senha, crie também `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

### Publicar uma versão

1. Atualize a versão em `src-tauri/tauri.conf.json` (e `package.json` / `src-tauri/Cargo.toml` se quiser manter sincronizado).
2. Faça push para a branch `release` **ou** dispare manualmente em **Actions → Release → Run workflow**.

O release é criado como **rascunho**; revise no GitHub e publique quando estiver pronto.

### Atualização no app

Com o app instalado, ao abrir a interface verifica o GitHub. Se houver versão mais nova, aparece o botão **Atualizar** na barra superior.

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
