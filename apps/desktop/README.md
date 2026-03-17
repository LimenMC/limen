# Limen Desktop

### Content Types
- Mods
- Modpacks
- Resource Packs
- Shaders
- Data Packs
- Plugins
- Servers (not work for now)

## 🚀 Development

### Prerequisites
- Node.js (v18 or higher)
- Rust (v1.77.2 or higher)
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run Tauri CLI commands
npm run tauri -- [command]

# Preview production build
npm run preview
```

## ⚙️ Configuration

### Application Data

The app stores configuration and data in:
- **Windows**: `%USERPROFILE%\.limen\`
- **macOS**: `~/.limen/`
- **Linux**: `~/.limen/`

## 🏗️ Building

### Development Build
```bash
npm run tauri dev
```

### Production Build
```bash
npm run tauri build
```

### Build Targets
The app supports building for:
- Windows (pass)
- macOS (i not have mac)
- Linux (i don't test)

### Installer Languages
- English
- Turkish
- German
- Simplified Chinese

## 🌐 Supported Languages

- 🇬🇧 English
- 🇹🇷 Turkish (Türkçe)
- 🇩🇪 German (Deutsch)
- 🇨🇳 Chinese (简体中文)

## 📝 License

GPL-3.0 - See [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and feature requests, please use the GitHub issue tracker.
