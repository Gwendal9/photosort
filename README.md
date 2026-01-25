# PhotoSort

Application desktop de tri intelligent de photos. Détecte automatiquement les photos similaires et doublons pour libérer de l'espace sur votre disque.

## Fonctionnalités

- **Sélecteur de dossiers en français** avec support WSL (accès aux disques Windows depuis Linux)
- **Détection de photos similaires** par hashing perceptuel (pas besoin d'internet)
- **Interface intuitive** pour comparer et nettoyer vos photos
- **Corbeille interne** avant suppression définitive
- **100% local** - vos photos ne quittent jamais votre ordinateur

## Stack technique

- **Frontend** : React 19 + TypeScript + Tailwind CSS 4 + Zustand
- **Backend** : Tauri 2 (Rust)
- **Analyse d'images** : image_hasher (hashing perceptuel)
- **Base de données** : SQLite (rusqlite)

## Installation

### Prérequis

**Node.js 18+** : [nodejs.org](https://nodejs.org/)

**Rust 1.77+** :
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Dépendances système** (Linux uniquement) :

```bash
# Ubuntu/Debian
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev \
  libappindicator3-dev librsvg2-dev patchelf pkg-config libssl-dev \
  libglib2.0-dev libcairo2-dev libpango1.0-dev libatk1.0-dev \
  libgdk-pixbuf-2.0-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget \
  libappindicator-gtk3-devel librsvg2-devel
sudo dnf group install "C Development Tools and Libraries"

# Arch Linux
sudo pacman -S webkit2gtk-4.1 base-devel curl wget openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
```

### Lancer l'application

```bash
# Cloner le repo
git clone https://github.com/VOTRE_USERNAME/photosort.git
cd photosort

# Installer les dépendances
npm install

# Lancer en mode développement
npm run tauri:dev
```

### Build (créer un exécutable)

```bash
npm run tauri:build
```

L'exécutable sera dans `src-tauri/target/release/`.

## Utilisation

1. Cliquez sur **"Ajouter un dossier"** pour ouvrir le sélecteur
2. Naviguez vers vos photos (les disques Windows sont dans `/mnt/c`, `/mnt/d`, etc.)
3. Cliquez sur **"Lancer l'analyse"**
4. Dans l'onglet **Comparaison**, visualisez les groupes de photos similaires
5. Sélectionnez la photo à garder et supprimez les doublons

## Structure du projet

```
photosort/
├── src/                    # Frontend React
│   ├── components/         # Composants UI
│   ├── stores/             # État global (Zustand)
│   ├── services/           # API Tauri
│   └── types/              # Types TypeScript
├── src-tauri/              # Backend Rust
│   ├── src/
│   │   ├── commands/       # Commandes exposées au frontend
│   │   ├── db/             # Base de données
│   │   └── lib.rs
│   └── Cargo.toml
└── package.json
```

## Licence

MIT
