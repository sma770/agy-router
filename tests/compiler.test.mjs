import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compileAgentsMarkdown,
  compileAndWriteRules,
  MAX_RULE_BYTES,
} from '../plugin/sidecars/panel/compiler.mjs';
import { DEFAULT_SETTINGS, normalizeSettings, PRESETS } from '../plugin/sidecars/panel/config.mjs';

test('disabled master switch compiles a compact zero-disturb stub without frontmatter', () => {
  const result = compileAgentsMarkdown(DEFAULT_SETTINGS);
  assert.equal(result.masterEnabled, false);
  assert.equal(result.enabledCount, 0);
  assert.equal(result.markdown.startsWith('---'), false);
  assert.ok(result.bytes < 600);
  assert.match(result.markdown, /零打扰/);
  assert.match(result.markdown, /sidecar:\/\/agy-router\/panel\//);
});

test('direct, balanced, and strict presets compile exact thresholds and omit disabled items', () => {
  const direct = compileAgentsMarkdown(PRESETS.direct);
  assert.equal(direct.markdown.startsWith('---'), false);
  assert.ok(direct.bytes < MAX_RULE_BYTES);
  assert.match(direct.markdown, /1～7 个文件/);
  assert.match(direct.markdown, /8 个及以上/);
  assert.doesNotMatch(direct.markdown, /run_workflow/);
  assert.doesNotMatch(direct.markdown, /\bswarm\b/);
  assert.doesNotMatch(direct.markdown, /\/teamwork/);

  const balanced = compileAgentsMarkdown(PRESETS.balanced);
  assert.match(balanced.markdown, /1～5 个文件/);
  assert.match(balanced.markdown, /6 个及以上/);
  assert.match(balanced.markdown, /公共接口 \/ 核心架构/);
  assert.doesNotMatch(balanced.markdown, /run_workflow/);
  assert.doesNotMatch(balanced.markdown, /\bswarm\b/);
  assert.doesNotMatch(balanced.markdown, /\/teamwork/);

  const strict = compileAgentsMarkdown(PRESETS.strict);
  assert.match(strict.markdown, /1～2 个文件/);
  assert.match(strict.markdown, /3 个及以上/);
  assert.match(strict.markdown, /5 个及以上/);
  assert.match(strict.markdown, /2 个及以上/);
  assert.match(strict.markdown, /\/teamwork/);
  assert.match(strict.markdown, /2 次及以上/);
});

test('individual toggles accurately include or exclude specific rules', () => {
  const custom = normalizeSettings({
    masterEnabled: true,
    plan: { enabled: false, minFiles: 6, triggerOnArchChange: true },
    grillMe: { enabled: false, strictness: 'relaxed', maxQuestions: 3 },
    runWorkflow: { enabled: false, minItems: 10 },
    swarm: { enabled: false, minModules: 3 },
    browser: { enabled: false },
    generativeUi: { enabled: false },
    boost: { enabled: false, minFailedAttempts: 3 },
    goal: { enabled: false },
    teamwork: { enabled: false },
    compact: { enabled: true, minTurns: 45 },
  });

  const compiled = compileAgentsMarkdown(custom);
  assert.equal(compiled.enabledCount, 1);
  assert.match(compiled.markdown, /当前未启用任何原生底层自动代执行规则/);
  assert.match(compiled.markdown, /45 轮/);
  assert.doesNotMatch(compiled.markdown, /Implementation Plan/);
  assert.doesNotMatch(compiled.markdown, /ask_question/);
  assert.doesNotMatch(compiled.markdown, /\/boost/);
});

test('compileAndWriteRules writes rules/AGENTS.md atomically to disk', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'agy-router-cmp-'));
  try {
    const out = compileAndWriteRules(tmpRoot, PRESETS.balanced);
    const disk = readFileSync(out.rulesPath, 'utf8');
    assert.equal(disk, out.markdown);
    assert.equal(disk.startsWith('---'), false);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
