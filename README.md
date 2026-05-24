# App Programs

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
