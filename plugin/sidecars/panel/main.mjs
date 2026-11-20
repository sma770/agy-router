import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COMMANDS_DATA } from './commands-data.mjs';
import { compileAgentsMarkdown, compileAndWriteRules, getRulesPath } from './compiler.mjs';
import {
  applyPreset,
  DEFAULT_SETTINGS,
  getSettingsPath,
  LIMITS,
  loadSettings,
  PRESET_META,
  saveSettings,
} from './config.mjs';
import { loadSidecarSdk } from './sdk.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_POST_BYTES = 64 * 1024;

export function resolvePluginRoot(overrideRoot) {
  return resolve(
    overrideRoot || process.env.AGY_ROUTER_PLUGIN_ROOT || join(HERE, '..', '..')
  );
}

/**
 * Core stateful service shared by Antigravity Sidecar mode and standalone HTTP preview.
 */
export function createRouterService(pluginRootOverride) {
  const pluginRoot = resolvePluginRoot(pluginRootOverride);

  function ensureInitialized() {
    const settingsPath = getSettingsPath(pluginRoot);
    const rulesPath = getRulesPath(pluginRoot);
    let settings = loadSettings(pluginRoot);
    if (!existsSync(settingsPath)) {
      settings = saveSettings(pluginRoot, settings);
    }
    if (!existsSync(rulesPath)) {
      compileAndWriteRules(pluginRoot, settings);
    }
    return settings;
  }

  function buildState(settings, extra = {}) {
    const compiled = compileAgentsMarkdown(settings);
    return {
      settings,
      presets: PRESET_META,
      limits: LIMITS,
      compiled,
      paths: {
        pluginRoot,
        settingsPath: getSettingsPath(pluginRoot),
        rulesPath: getRulesPath(pluginRoot),
      },
      ...extra,
    };
  }

  function getState() {
    const settings = ensureInitialized();
    return buildState(settings);
  }

  function updateSettings(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('请求体必须是 JSON 对象');
    }
    const current = ensureInitialized();
    const saved = saveSettings(pluginRoot, { ...current, ...payload });
    const compiled = compileAndWriteRules(pluginRoot, saved);
    return {
      ...buildState(saved, { savedAt: new Date().toISOString() }),
      compiled,
    };
  }

  function setPreset(presetId) {
    if (typeof presetId !== 'string' || !presetId) {
      throw new Error('缺少 presetId 参数');
    }
    const current = ensureInitialized();
    const next = applyPreset(current, presetId);
    const saved = saveSettings(pluginRoot, next);
    const compiled = compileAndWriteRules(pluginRoot, saved);
    return {
      ...buildState(saved, { savedAt: new Date().toISOString() }),
      compiled,
    };
  }

  function resetSettings() {
    const saved = saveSettings(pluginRoot, DEFAULT_SETTINGS);
    const compiled = compileAndWriteRules(pluginRoot, saved);
    return {
      ...buildState(saved, { savedAt: new Date().toISOString() }),
      compiled,
    };
  }

  return {
    pluginRoot,
    ensureInitialized,
    getState,
    updateSettings,
    setPreset,
    resetSettings,
  };
}

function readStaticAsset(pluginRoot, fileName) {
  if (fileName === 'logo.svg') {
    const logoPath = join(pluginRoot, 'assets', 'logo.svg');
    if (existsSync(logoPath)) return readFileSync(logoPath, 'utf8');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"></svg>';
  }
  return readFileSync(join(HERE, fileName), 'utf8');
}

const STATIC_FILES = {
  '/': { file: 'index.html', contentType: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', contentType: 'text/html; charset=utf-8' },
  '/styles.css': { file: 'styles.css', contentType: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', contentType: 'application/javascript; charset=utf-8' },
  '/logo.svg': { file: 'logo.svg', contentType: 'image/svg+xml; charset=utf-8' },
};

function badRequest(ResponseCtor, message) {
  return new ResponseCtor(JSON.stringify({ error: message }), {
    status: 400,
    contentType: 'application/json; charset=utf-8',
  });
}

/**
 * Start the Antigravity Sidecar server using the host-provided SidecarApp SDK.
 */
export async function startSidecarServer(pluginRootOverride) {
  const service = createRouterService(pluginRootOverride);
  service.ensureInitialized();

  const { SidecarApp, Response } = await loadSidecarSdk();
  const app = new SidecarApp();

  for (const [route, meta] of Object.entries(STATIC_FILES)) {
    app.api(
      route,
      () =>
        new Response(readStaticAsset(service.pluginRoot, meta.file), {
          contentType: meta.contentType,
          headers: { 'Cache-Control': 'no-store' },
        }),
      'GET'
    );
  }

  app.api('/api/state', () => service.getState(), 'GET');
  app.api('/api/commands', () => COMMANDS_DATA, 'GET');

  app.api(
    '/api/settings',
    (data) => {
      try {
        return service.updateSettings(data);
      } catch (err) {
        return badRequest(Response, err.message);
      }
    },
    'POST'
  );

  app.api(
    '/api/preset',
    (data) => {
      try {
        return service.setPreset(data?.presetId);
      } catch (err) {
        return badRequest(Response, err.message);
      }
    },
    'POST'
  );

  app.api(
    '/api/reset',
    () => {
      try {
        return service.resetSettings();
      } catch (err) {
        return badRequest(Response, err.message);
      }
    },
    'POST'
  );

  await app.run();
  return app;
}

/**
 * Start a loopback-only HTTP server for standalone browser preview and automated tests.
 */
export async function createStandaloneServer({
  pluginRoot,
  port = Number(process.env.AGY_ROUTER_PORT || 17920),
} = {}) {
  const service = createRouterService(pluginRoot);
  service.ensureInitialized();

  const server = createServer(async (req, res) => {
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Forbidden host' }));
      return;
    }

    const url = new URL(req.url || '/', `http://${host}`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'GET' && url.pathname === '/preload.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end('// Standalone preview: no Antigravity host bridge.\n');
      return;
    }

    if (req.method === 'GET' && STATIC_FILES[url.pathname]) {
      const meta = STATIC_FILES[url.pathname];
      res.writeHead(200, { 'Content-Type': meta.contentType });
      res.end(readStaticAsset(service.pluginRoot, meta.file));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(service.getState()));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/commands') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(COMMANDS_DATA));
      return;
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      const origin = req.headers.origin;
      if (origin && origin !== `http://${host}`) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Cross-origin request rejected' }));
        return;
      }

      let rawBody = '';
      try {
        for await (const chunk of req) {
          rawBody += chunk;
          if (Buffer.byteLength(rawBody, 'utf8') > MAX_POST_BYTES) {
            res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Payload too large' }));
            return;
          }
        }
        const body = rawBody.trim() ? JSON.parse(rawBody) : {};

        let result;
        if (url.pathname === '/api/settings') {
          result = service.updateSettings(body);
        } else if (url.pathname === '/api/preset') {
          result = service.setPreset(body?.presetId);
        } else if (url.pathname === '/api/reset') {
          result = service.resetSettings();
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise((resolveListen) => {
    server.listen(port, '127.0.0.1', resolveListen);
  });

  const addr = server.address();
  return {
    server,
    service,
    port: typeof addr === 'object' && addr ? addr.port : port,
    baseUrl: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : port}`,
    close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
    await startSidecarServer();
  } else {
    const instance = await createStandaloneServer();
    console.log(`AGY 智能路由台独立预览地址: ${instance.baseUrl}`);
  }
}
