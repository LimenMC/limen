# Limen Monorepo

ANYONE CAN WRİTE A README PLS?

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Rust 1.77.2+ (for desktop app)
- Tauri CLI (for desktop app)

## 🛠️ CLI Commands

### Using npm scripts (works everywhere)

| Command | Description |
|---------|-------------|
| `npm run dev:desktop` | Start desktop app in dev mode |
| `npm run dev:web` | Start web app in dev mode |
| `npm run build` | Build all apps and packages |
| `npm run build:desktop` | Build desktop app only |
| `npm run build:web` | Build web app only |
| `npm run build:packages` | Build shared packages only |
| `npm run clean` | Remove all build artifacts |
| `npm run tauri` | Run Tauri CLI commands |
| `npm run lint` | Lint all packages |

### Using limen CLI (after `npm link`)

| Command | Description |
|---------|-------------|
| `limen dev desktop` | Start desktop app in dev mode |
| `limen dev web` | Start web app in dev mode |
| `limen build all` | Build all apps and packages |
| `limen build desktop` | Build desktop app only |
| `limen build web` | Build web app only |
| `limen build packages` | Build shared packages only |
| `limen clean` | Remove all build artifacts |
| `limen help` | Show help |

## 📦 Workspaces

### Apps

- **desktop**: Main Limen launcher (Tauri + React)
- **web**: Website (Next.js) not finished

### Packages

- **@limen/ui**: Shared UI component library
- **@limen/utils**: Shared utility functions
- **@limen/types**: Shared TypeScript type definitions
- **@limen/i18n**: Internationalization configuration

## 🌍 Internationalization

Limen supports multiple languages:
- English (en)
- Turkish (tr)
- Chinese (zh)
- German (de)

Translation files are located in `packages/i18n/locales/`.

## 📄 License

GPL-3.0 License - see LICENSE file for details
