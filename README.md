# PhotoSort

Application desktop de tri intelligent de photos utilisant l'IA pour détecter les photos similaires.

## Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Tauri 2.0 (Rust)
- **ML**: Python + CLIP (OpenAI)
- **Database**: SQLite

## Fonctionnalités

- Scan de dossiers photos
- Détection de similarité par IA (pas juste doublons exacts)
- Comparaison côte à côte
- Corbeille interne sécurisée
- 100% offline / local-first

## Installation

### Prérequis

```bash
# Linux (Ubuntu/Debian)
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev \
  libappindicator3-dev librsvg2-dev patchelf pkg-config libssl-dev \
  libglib2.0-dev libcairo2-dev libpango1.0-dev libatk1.0-dev \
  libgdk-pixbuf-2.0-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 18+
```

### Développement

```bash
npm install
npm run tauri:dev
```

### Build

```bash
npm run tauri:build
```

## Structure

```
photosort/
├── src/                    # Frontend React
├── src-tauri/              # Backend Rust
└── python/                 # ML Sidecar (CLIP)
```

## License

MIT
