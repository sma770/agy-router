import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Safely locate and load the official Antigravity `sidecar_sdk` ESM module.
 * Falls back cleanly across ESM import, CommonJS resolution, and standard host lib paths.
 */
export async function loadSidecarSdk() {
  try {
    return await import('sidecar_sdk');
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND' && err?.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
  }

  try {
    const require = createRequire(import.meta.url);
    const resolved = require.resolve('sidecar_sdk');
    return await import(pathToFileURL(resolved).href);
  } catch (err) {
    if (err?.code !== 'MODULE_NOT_FOUND' && err?.code !== 'ERR_MODULE_NOT_FOUND') {
      throw err;
    }
  }

  const candidatePaths = [];
  const dataDir = process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR;
  if (dataDir) {
    let cursor = dataDir;
    for (let i = 0; i < 6; i += 1) {
      candidatePaths.push(
        join(cursor, 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs')
      );
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }

  candidatePaths.push(
    join(
      homedir(),
      '.gemini',
      'antigravity',
      'lib',
      'node_modules',
      'sidecar_sdk',
      'index.mjs'
    )
  );

  for (const sdkPath of candidatePaths) {
    if (existsSync(sdkPath)) {
      return await import(pathToFileURL(sdkPath).href);
    }
  }

  throw new Error(
    '无法加载官方 sidecar_sdk：请确认在 Antigravity 2.0 桌面端 Sidecar 环境运行，或检查 ~/.gemini/antigravity/lib/node_modules/sidecar_sdk 是否存在。'
  );
}
