#!/usr/bin/env node
/**
 * Uninstall the agy-router Antigravity UI plugin cleanly.
 * Supports --keep-settings to back up data/settings.json before removal.
 */

import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  let target = join(homedir(), '.gemini', 'config', 'plugins', 'agy-router');
  let keepSettings = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--keep-settings') {
      keepSettings = true;
    } else if (arg === '--target' && argv[i + 1]) {
      target = resolve(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--target=')) {
      target = resolve(arg.slice('--target='.length));
    } else if (arg === '--help' || arg === '-h') {
      console.log('用法: node scripts/uninstall.mjs [--target <插件目录>] [--keep-settings]');
      process.exit(0);
    }
  }
  return { target, keepSettings };
}

export function uninstallPlugin({ targetDir, keepSettings = false, backupPath } = {}) {
  const target = resolve(
    targetDir || join(homedir(), '.gemini', 'config', 'plugins', 'agy-router')
  );

  if (!existsSync(target)) {
    return { removed: false, target, backupFile: null };
  }

  let backupFile = null;
  const settingsFile = join(target, 'data', 'settings.json');
  if (keepSettings && existsSync(settingsFile)) {
    backupFile =
      backupPath ||
      join(homedir(), '.gemini', 'config', 'agy-router.settings.backup.json');
    mkdirSync(dirname(backupFile), { recursive: true });
    copyFileSync(settingsFile, backupFile);
  }

  rmSync(target, { recursive: true, force: true });
  return { removed: true, target, backupFile };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { target, keepSettings } = parseArgs(process.argv.slice(2));
    const result = uninstallPlugin({ targetDir: target, keepSettings });
    if (!result.removed) {
      console.log(`ℹ️ 插件目录不存在，无需卸载: ${result.target}`);
    } else {
      console.log(`✅ 已卸载 AGY 智能路由台插件: ${result.target}`);
      if (result.backupFile) {
        console.log(`   已备份个人配置至: ${result.backupFile}`);
      }
    }
  } catch (err) {
    console.error(`❌ 卸载失败: ${err.message}`);
    process.exit(1);
  }
}
