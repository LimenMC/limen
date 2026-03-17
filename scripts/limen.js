#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.cyan) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}✗ ${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || rootDir,
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve();
      }
    });

    child.on('error', reject);
  });
}

async function buildPackages() {
  log('\n📦 Building shared packages...', colors.blue);
  
  const packages = ['types', 'utils', 'i18n', 'ui'];
  
  for (const pkg of packages) {
    log(`\n  Building @limen/${pkg}...`, colors.cyan);
    try {
      await runCommand('npm', ['run', 'build', '--workspace', `packages/${pkg}`]);
      success(`  @limen/${pkg} built successfully`);
    } catch (err) {
      error(`  Failed to build @limen/${pkg}`);
      throw err;
    }
  }
  
  success('\n✓ All packages built successfully\n');
}

async function dev(target) {
  if (!target || target === 'desktop') {
    log('\n🚀 Starting Limen Desktop in development mode...', colors.magenta);
    await runCommand('npm', ['run', 'tauri', 'dev'], { cwd: join(rootDir, 'apps/desktop') });
  } else if (target === 'web') {
    log('\n🌐 Starting Limen Web in development mode...', colors.magenta);
    await runCommand('npm', ['run', 'dev'], { cwd: join(rootDir, 'apps/web') });
  } else {
    error(`Unknown target: ${target}`);
    error('Usage: limen dev desktop or limen dev web');
    process.exit(1);
  }
}

async function build(target) {
  if (target === 'packages') {
    await buildPackages();
    return;
  }

  if (target === 'all') {
    log('\n🏗️  Building entire monorepo...', colors.blue);
    await buildPackages();
    
    log('\n📱 Building Desktop app...', colors.blue);
    await runCommand('npm', ['run', 'tauri', 'build'], { cwd: join(rootDir, 'apps/desktop') });
    success('Desktop app built successfully');
    
    log('\n🌐 Building Web app...', colors.blue);
    await runCommand('npm', ['run', 'build'], { cwd: join(rootDir, 'apps/web') });
    success('Web app built successfully');
    
    success('\n✓ All builds completed successfully\n');
    return;
  }

  if (target === 'desktop') {
    log('\n📱 Building Desktop app...', colors.blue);
    await buildPackages();
    await runCommand('npm', ['run', 'tauri', 'build'], { cwd: join(rootDir, 'apps/desktop') });
    success('\n✓ Desktop app built successfully\n');
  } else if (target === 'web') {
    log('\n🌐 Building Web app...', colors.blue);
    await buildPackages();
    await runCommand('npm', ['run', 'build'], { cwd: join(rootDir, 'apps/web') });
    success('\n✓ Web app built successfully\n');
  } else {
    error(`Unknown target: ${target}`);
    error('Usage: limen build desktop, limen build web, or limen build all');
    process.exit(1);
  }
}

async function clean() {
  log('\n🧹 Cleaning build artifacts...', colors.yellow);
  
  log('  Cleaning packages...', colors.cyan);
  await runCommand('npm', ['run', 'clean', '--workspaces', '--if-present']);
  
  log('  Cleaning node_modules...', colors.cyan);
  await runCommand('rm', ['-rf', 'node_modules']);
  
  success('\n✓ Cleanup completed\n');
}

function showHelp() {
  console.log(`
${colors.bright}${colors.cyan}Limen CLI${colors.reset}

${colors.bright}Usage:${colors.reset}
  limen <command> [target]

${colors.bright}Development:${colors.reset}
  ${colors.green}limen dev desktop${colors.reset}     Start desktop app (runs: npm run tauri dev)
  ${colors.green}limen dev web${colors.reset}         Start web app (runs: npm run dev)

${colors.bright}Build:${colors.reset}
  ${colors.blue}limen build all${colors.reset}        Build all apps and packages
  ${colors.blue}limen build desktop${colors.reset}    Build desktop app (runs: npm run tauri build)
  ${colors.blue}limen build web${colors.reset}        Build web app (runs: npm run build)
  ${colors.blue}limen build packages${colors.reset}   Build shared packages only

${colors.bright}Other:${colors.reset}
  ${colors.yellow}limen clean${colors.reset}           Remove all build artifacts and node_modules

${colors.bright}Examples:${colors.reset}
  limen dev desktop
  limen build desktop
  limen build all
  limen clean
`);
}

async function main() {
  const [command, target] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  try {
    switch (command) {
      case 'dev':
        await dev(target);
        break;
      case 'build':
        await build(target || 'all');
        break;
      case 'clean':
        await clean();
        break;
      default:
        error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    error(`\n${err.message}`);
    process.exit(1);
  }
}

main();
