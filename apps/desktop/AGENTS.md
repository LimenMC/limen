# AGENTS.md

## Must-follow constraints

- Use npm only (not yarn/pnpm) - enforced by Tauri config `beforeDevCommand` and `beforeBuildCommand`
- Tailwind CSS 4 uses `@tailwindcss/vite` plugin - no separate tailwind.config file needed
- Rust minimum version: 1.77.2
- CSP is strict: only `api.modrinth.com`, `crafatar.com`, `minotar.net` allowed for external connections
- User data stored in `~/.limen/` (Windows: `%USERPROFILE%\.limen\`) - never hardcode paths, use Tauri path APIs
- Microsoft auth tokens stored in system keyring via `keyring::Entry::new("limen", "minecraft_profile")` - never store in files

## Validation before finishing

```bash
npm run build  # Runs tsc && vite build
```

## Repo-specific conventions

- Frontend: React 18 + TypeScript + Vite
- Backend: Tauri 2 commands in `src-tauri/src/commands/`
- All Tauri commands must return `Result<T, AppError>` from `src-tauri/src/error.rs`
- Mod loader installers (Fabric/Forge/NeoForge/Quilt) extract to temp `forge_data_temp`/`neoforge_data_temp` directories
- Three.js code isolated to Skins page - chunked separately in Vite config
- i18n files in `src/i18n/locales/` - supported: en, tr, de, zh

## Important locations

- Tauri commands: `src-tauri/src/commands/*.rs`
- Frontend Tauri wrappers: `src/lib/tauri-commands.ts`
- Error types: `src-tauri/src/error.rs`
- NSIS installer: `src-tauri/installer.nsi` with multi-language support

## Change safety rules

- Do not modify CSP in `tauri.conf.json` without explicit request - breaks external API access
- Do not change Vite port (5175) - hardcoded in Tauri config
- Preserve `native-tls-vendored` feature in reqwest - required for cross-platform TLS
- Keep release profile settings (`lto = true`, `opt-level = "s"`) - critical for binary size

## Known gotchas

- Forge/NeoForge installers require Java runtime - must be detected or configured before installation
- Window decorations disabled (`decorations: false`) - custom title bar in `src/components/TitleBar.tsx`
- SQLite database at `~/.limen/limen.db` - use `tauri-plugin-sql` only, not direct sqlx
- Vite optimizeDeps excludes `lightningcss` and `@tailwindcss/oxide` - do not remove
