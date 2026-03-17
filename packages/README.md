# Limen Packages

Shared packages used across Limen applications.

## Available Packages

### Coming Soon

- **@limen/ui** - Shared UI component library
- **@limen/utils** - Shared utility functions  
- **@limen/types** - Shared TypeScript type definitions
- **@limen/api** - Shared API client
- **@limen/config** - Shared configuration

## Creating a New Package

```bash
# Create package directory
mkdir packages/my-package
cd packages/my-package

# Initialize package.json
npm init -y

# Update package.json name to @limen/my-package
```

### Package Structure

```
packages/my-package/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Package.json Template

```json
{
  "name": "@limen/my-package",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.5.3"
  }
}
```

## Using Packages

In your app's `package.json`:

```json
{
  "dependencies": {
    "@limen/my-package": "*"
  }
}
```

Then import:

```typescript
import { something } from '@limen/my-package';
```
