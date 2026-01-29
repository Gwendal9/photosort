# PhotoSort

Application web de tri intelligent de photos. Détecte automatiquement les photos similaires et doublons pour libérer de l'espace sur votre disque.

**100% local** — vos photos ne quittent jamais votre navigateur, aucun serveur n'est impliqué.

## Fonctionnalités

- **Détection de photos similaires** par hashing perceptuel (gradient hash 64 bits)
- **Seuil de similarité ajustable** (50% à 99%) pour affiner les résultats
- **Interface intuitive** pour comparer et nettoyer vos photos par groupes
- **Corbeille interne** avant suppression définitive
- **Traitement parallèle** via Web Workers pour des performances optimales
- **Support multi-formats** : JPG, PNG, WebP, GIF, BMP, AVIF, HEIC, HEIF, formats RAW

## Stack technique

- **Frontend** : React 19 + TypeScript + Tailwind CSS 4 + Zustand
- **Build** : Vite 7
- **APIs Web** : File System Access API, Web Workers, OffscreenCanvas
- **Déploiement** : Vercel

## Compatibilité navigateur

| Navigateur | Support |
|---|---|
| Chrome 86+ | Complet |
| Edge 86+ | Complet |
| Firefox | Non supporté (pas de File System Access API) |
| Safari | Non supporté (pas de File System Access API) |

## Installation

### Prérequis

- **Node.js 18+** : [nodejs.org](https://nodejs.org/)
- **Chrome ou Edge** (requis pour l'accès aux fichiers)

### Lancer en local

```bash
# Cloner le repo
git clone https://github.com/Gwendal9/photosort.git
cd photosort

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

Le serveur de développement démarre sur `http://localhost:5173`.

### Build de production

```bash
npm run build
```

Les fichiers sont générés dans `./dist`.

## Déploiement

L'application est configurée pour Vercel :

1. Connecter le repo GitHub à Vercel
2. Vercel exécute automatiquement `npm run build` et déploie le dossier `dist/`
3. Le fichier `vercel.json` gère le routing SPA

## Utilisation

1. Ouvrez l'application dans **Chrome** ou **Edge**
2. Cliquez sur **"Ajouter un dossier"** et sélectionnez un dossier de photos
3. Cliquez sur **"Lancer l'analyse"**
4. Dans l'onglet **Comparaison**, visualisez les groupes de photos similaires
5. Ajustez le seuil de similarité si nécessaire
6. Sélectionnez les photos à supprimer — elles vont dans la corbeille
7. Videz la corbeille quand vous êtes prêt

## Structure du projet

```
photosort/
├── src/
│   ├── components/
│   │   ├── folders/          # Sélection de dossiers
│   │   ├── comparison/       # Comparaison des similaires
│   │   ├── photos/           # Grille et cartes photo
│   │   ├── trash/            # Corbeille
│   │   └── common/           # Barre de progression, toasts
│   ├── stores/               # État global (Zustand)
│   ├── services/             # File System API, analyse d'images
│   ├── workers/              # Web Worker de hashing
│   ├── hooks/                # Hooks React
│   ├── types/                # Types TypeScript
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── vercel.json
└── package.json
```

## Licence

MIT
