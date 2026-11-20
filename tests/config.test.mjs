import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyPreset,
  DEFAULT_SETTINGS,
  detectPreset,
  loadSettings,
  normalizeSettings,
  PRESETS,
  saveSettings,
} from '../plugin/sidecars/panel/config.mjs';

test('DEFAULT_SETTINGS starts in zero-disturb off mode with balanced underlying values', () => {
  assert.equal(DEFAULT_SETTINGS.masterEnabled, false);
  assert.equal(DEFAULT_SETTINGS.activePreset, 'off');
  assert.equal(DEFAULT_SETTINGS.plan.minFiles, 6);
  assert.equal(DEFAULT_SETTINGS.grillMe.maxQuestions, 3);
  assert.equal(DEFAULT_SETTINGS.swarm.enabled, false);
  assert.equal(DEFAULT_SETTINGS.runWorkflow.enabled, false);
});

test('normalizeSettings clamps out-of-bounds sliders and invalid enums', () => {
  const normalized = normalizeSettings({
    masterEnabled: true,
    plan: { enabled: true, minFiles: 99, triggerOnArchChange: false },
    grillMe: { enabled: true, strictness: 'bogus', maxQuestions: 0 },
    runWorkflow: { enabled: true, minItems: 100 },
    swarm: { enabled: true, minModules: 1 },
    boost: { enabled: true, minFailedAttempts: 99 },
    compact: { enabled: true, minTurns: 23 },
  });

  assert.equal(normalized.masterEnabled, true);
  assert.equal(normalized.plan.minFiles, 15);
  assert.equal(normalized.grillMe.strictness, 'relaxed');
  assert.equal(normalized.grillMe.maxQuestions, 1);
  assert.equal(normalized.runWorkflow.minItems, 30);
  assert.equal(normalized.swarm.minModules, 2);
  assert.equal(normalized.boost.minFailedAttempts, 5);
  assert.equal(normalized.compact.minTurns, 25);
  assert.equal(normalized.activePreset, 'custom');
});

test('normalizeSettings clamps lower bounds cleanly', () => {
  const normalized = normalizeSettings({
    masterEnabled: true,
    plan: { minFiles: 1 },
    runWorkflow: { minItems: 2 },
    boost: { minFailedAttempts: 0 },
    compact: { minTurns: 5 },
  });

  assert.equal(normalized.plan.minFiles, 3);
  assert.equal(normalized.runWorkflow.minItems, 5);
  assert.equal(normalized.boost.minFailedAttempts, 2);
  assert.equal(normalized.compact.minTurns, 15);
});

test('applyPreset("off") preserves existing custom slider values', () => {
  const custom = normalizeSettings({
    masterEnabled: true,
    plan: { enabled: true, minFiles: 11, triggerOnArchChange: false },
    grillMe: { enabled: true, strictness: 'strict', maxQuestions: 4 },
  });
  assert.equal(custom.activePreset, 'custom');

  const paused = applyPreset(custom, 'off');
  assert.equal(paused.masterEnabled, false);
  assert.equal(paused.activePreset, 'off');
  assert.equal(paused.plan.minFiles, 11);
  assert.equal(paused.plan.triggerOnArchChange, false);
  assert.equal(paused.grillMe.strictness, 'strict');
  assert.equal(paused.grillMe.maxQuestions, 4);
});

test('detectPreset accurately distinguishes off, direct, balanced, strict, and custom', () => {
  assert.equal(detectPreset(normalizeSettings(PRESETS.off)), 'off');
  assert.equal(detectPreset(normalizeSettings(PRESETS.direct)), 'direct');
  assert.equal(detectPreset(normalizeSettings(PRESETS.balanced)), 'balanced');
  assert.equal(detectPreset(normalizeSettings(PRESETS.strict)), 'strict');

  const tweaked = normalizeSettings({
    ...PRESETS.balanced,
    plan: { ...PRESETS.balanced.plan, minFiles: 7 },
  });
  assert.equal(detectPreset(tweaked), 'custom');
});

test('saveSettings and loadSettings round-trip cleanly in a temp plugin root', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'agy-router-cfg-'));
  try {
    const initial = loadSettings(tmpRoot);
    assert.deepEqual(initial, DEFAULT_SETTINGS);

    const updated = normalizeSettings({
      masterEnabled: true,
      plan: { enabled: true, minFiles: 9, triggerOnArchChange: false },
      swarm: { enabled: true, minModules: 4 },
    });
    saveSettings(tmpRoot, updated);

    const reloaded = loadSettings(tmpRoot);
    assert.deepEqual(reloaded, updated);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
