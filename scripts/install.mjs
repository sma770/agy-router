#!/usr/bin/env node
/**
 * Install or upgrade the agy-router Antigravity UI plugin.
 * Preserves existing user settings (data/settings.json) across upgrades
 * and compiles rules/AGENTS.md cleanly.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const PLUGIN_SRC = join(REPO_ROOT, 'plugin');

function parseArgs(argv) {
  let target = join(homedir(), '.gemini', 'config', 'plugins', 'agy-router');
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target' && argv[i + 1]) {
      target = resolve(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--target=')) {
      target = resolve(arg.slice('--target='.length));
    } else if (arg === '--help' || arg === '-h') {
      console.log('用法: node scripts/install.mjs [--target <插件安装目录>]');
      process.exit(0);
    }
  }
  return { target };
}

export async function installPlugin({ targetDir } = {}) {
  const target = resolve(
    targetDir || join(homedir(), '.gemini', 'config', 'plugins', 'agy-router')
  );

  if (!existsSync(join(PLUGIN_SRC, 'plugin.json'))) {
    throw new Error(`找不到插件源码目录：${PLUGIN_SRC}`);
  }

  const targetSettingsPath = join(target, 'data', 'settings.json');
  let preservedSettingsRaw = null;
  if (existsSync(targetSettingsPath)) {
    preservedSettingsRaw = readFileSync(targetSettingsPath, 'utf8');
  }

  // Clean static directories before copying so removed files don't linger,
  // while leaving data/ untouched.
  for (const dirName of ['assets', 'rules', 'skills', 'sidecars']) {
    const staleDir = join(target, dirName);
    if (existsSync(staleDir)) {
      rmSync(staleDir, { recursive: true, force: true });
    }
  }

  mkdirSync(target, { recursive: true });
  const srcDataPrefix = join(PLUGIN_SRC, 'data');

  cpSync(PLUGIN_SRC, target, {
    recursive: true,
    force: true,
    filter: (src) => {
      const resolvedSrc = resolve(src);
      return (
        resolvedSrc !== srcDataPrefix &&
        !resolvedSrc.startsWith(`${srcDataPrefix}\\`) &&
        !resolvedSrc.startsWith(`${srcDataPrefix}/`)
      );
    },
  });

  if (preservedSettingsRaw !== null) {
    mkdirSync(dirname(targetSettingsPath), { recursive: true });
    writeFileSync(targetSettingsPath, preservedSettingsRaw, 'utf8');
  }

  const configMod = await import(
    pathToFileURL(join(target, 'sidecars', 'panel', 'config.mjs')).href
  );
  const compilerMod = await import(
    pathToFileURL(join(target, 'sidecars', 'panel', 'compiler.mjs')).href
  );

  const settings = configMod.loadSettings(target);
  const savedSettings = configMod.saveSettings(target, settings);
  const compiled = compilerMod.compileAndWriteRules(target, savedSettings);

  return {
    target,
    upgraded: preservedSettingsRaw !== null,
    settings: savedSettings,
    compiled,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { target } = parseArgs(process.argv.slice(2));
    const result = await installPlugin({ targetDir: target });
    const modeLabel = result.settings.masterEnabled
      ? `已启用（${result.settings.activePreset}）`
      : '零打扰起步（总开关默认关闭）';

    console.log(result.upgraded ? '✅ 已升级 AGY 智能路由台插件（已保留原有配置）' : '✅ 已安装 AGY 智能路由台插件');
    console.log(`   安装目录: ${result.target}`);
    console.log(`   当前状态: ${modeLabel}`);
    console.log(`   规则文件: ${join(result.target, 'rules', 'AGENTS.md')} (${result.compiled.bytes} 字节)`);
    console.log('   提示: 在 Antigravity App 聊天框输入 /agy-router 即可打开控制面板或查询指令。');
  } catch (err) {
    console.error(`❌ 安装失败: ${err.message}`);
    process.exit(1);
  }
}
