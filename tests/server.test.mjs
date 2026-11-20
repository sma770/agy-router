import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStandaloneServer } from '../plugin/sidecars/panel/main.mjs';
import { installPlugin } from '../scripts/install.mjs';
import { uninstallPlugin } from '../scripts/uninstall.mjs';

function sendRawHostRequest(port, path, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers: { Host: hostHeader },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

test('standalone server serves UI assets, 19 commands, and persists settings + rules', async () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'agy-router-srv-'));
  const srv = await createStandaloneServer({ pluginRoot: tmpRoot, port: 0 });

  try {
    for (const [path, typePart] of [
      ['/', 'text/html'],
      ['/styles.css', 'text/css'],
      ['/app.js', 'application/javascript'],
      ['/preload.js', 'application/javascript'],
      ['/logo.svg', 'image/svg+xml'],
    ]) {
      const res = await fetch(`${srv.baseUrl}${path}`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type').includes(typePart));
    }

    const cmdsRes = await fetch(`${srv.baseUrl}/api/commands`);
    assert.equal(cmdsRes.status, 200);
    const cmds = await cmdsRes.json();
    assert.equal(cmds.commands.length, 19);

    const stateRes = await fetch(`${srv.baseUrl}/api/state`);
    assert.equal(stateRes.status, 200);
    const initial = await stateRes.json();
    assert.equal(initial.settings.masterEnabled, false);
    assert.equal(initial.settings.activePreset, 'off');

    const rulesOnDisk = readFileSync(join(tmpRoot, 'rules', 'AGENTS.md'), 'utf8');
    assert.match(rulesOnDisk, /零打扰/);
    assert.equal(rulesOnDisk.startsWith('---'), false);

    // Apply balanced preset
    const presetRes = await fetch(`${srv.baseUrl}/api/preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'balanced' }),
    });
    assert.equal(presetRes.status, 200);
    const balancedState = await presetRes.json();
    assert.equal(balancedState.settings.masterEnabled, true);
    assert.equal(balancedState.settings.activePreset, 'balanced');
    assert.match(
      readFileSync(join(tmpRoot, 'rules', 'AGENTS.md'), 'utf8'),
      /6 个及以上/
    );

    // Update slider to 7 and disable arch trigger
    const patchRes = await fetch(`${srv.baseUrl}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: { enabled: true, minFiles: 7, triggerOnArchChange: false },
      }),
    });
    assert.equal(patchRes.status, 200);
    const customState = await patchRes.json();
    assert.equal(customState.settings.activePreset, 'custom');
    assert.equal(customState.settings.plan.minFiles, 7);
    assert.equal(customState.settings.plan.triggerOnArchChange, false);

    const updatedRules = readFileSync(join(tmpRoot, 'rules', 'AGENTS.md'), 'utf8');
    assert.match(updatedRules, /7 个及以上/);
    assert.match(updatedRules, /1～6 个文件/);

    const savedJson = JSON.parse(
      readFileSync(join(tmpRoot, 'data', 'settings.json'), 'utf8')
    );
    assert.equal(savedJson.plan.minFiles, 7);

    // Reset back to zero-disturb default
    const resetRes = await fetch(`${srv.baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(resetRes.status, 200);
    const resetState = await resetRes.json();
    assert.equal(resetState.settings.masterEnabled, false);
    assert.equal(resetState.settings.activePreset, 'off');

    // Invalid preset -> 400
    const badPresetRes = await fetch(`${srv.baseUrl}/api/preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'nonexistent' }),
    });
    assert.equal(badPresetRes.status, 400);

    // Non-loopback Host header -> 403
    const evilHost = await sendRawHostRequest(srv.port, '/api/state', 'evil.example.com');
    assert.equal(evilHost.status, 403);
  } finally {
    await srv.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('installPlugin preserves user settings on upgrade and uninstallPlugin cleans up', async () => {
  const tmpTarget = mkdtempSync(join(tmpdir(), 'agy-router-inst-'));
  const backupFile = join(tmpTarget, '..', 'agy-router-backup.json');

  try {
    const first = await installPlugin({ targetDir: tmpTarget });
    assert.equal(first.upgraded, false);
    assert.equal(first.settings.masterEnabled, false);
    assert.ok(existsSync(join(tmpTarget, 'plugin.json')));
    assert.ok(existsSync(join(tmpTarget, 'rules', 'AGENTS.md')));

    // Simulate user customizing via server
    const srv = await createStandaloneServer({ pluginRoot: tmpTarget, port: 0 });
    try {
      await fetch(`${srv.baseUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterEnabled: true,
          plan: { enabled: true, minFiles: 10, triggerOnArchChange: false },
        }),
      });
    } finally {
      await srv.close();
    }

    // Upgrade preserves customized settings and recompiles rules
    const second = await installPlugin({ targetDir: tmpTarget });
    assert.equal(second.upgraded, true);
    assert.equal(second.settings.masterEnabled, true);
    assert.equal(second.settings.plan.minFiles, 10);
    assert.match(
      readFileSync(join(tmpTarget, 'rules', 'AGENTS.md'), 'utf8'),
      /10 个及以上/
    );

    const removed = uninstallPlugin({
      targetDir: tmpTarget,
      keepSettings: true,
      backupPath: backupFile,
    });
    assert.equal(removed.removed, true);
    assert.equal(existsSync(tmpTarget), false);
    assert.equal(existsSync(backupFile), true);
  } finally {
    rmSync(tmpTarget, { recursive: true, force: true });
    rmSync(backupFile, { force: true });
  }
});
