import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const LIMITS = Object.freeze({
  planMinFiles: Object.freeze({ min: 3, max: 15, step: 1 }),
  grillMeMaxQuestions: Object.freeze({ min: 1, max: 5, step: 1 }),
  grillMeStrictness: Object.freeze(['relaxed', 'standard', 'strict']),
  runWorkflowMinItems: Object.freeze({ min: 5, max: 30, step: 1 }),
  swarmMinModules: Object.freeze({ min: 2, max: 6, step: 1 }),
  boostMinFailedAttempts: Object.freeze({ min: 2, max: 5, step: 1 }),
  compactMinTurns: Object.freeze({ min: 15, max: 60, step: 5 }),
});

const BALANCED_FEATURES = Object.freeze({
  plan: Object.freeze({
    enabled: true,
    minFiles: 6,
    triggerOnArchChange: true,
  }),
  grillMe: Object.freeze({
    enabled: true,
    strictness: 'relaxed',
    maxQuestions: 3,
  }),
  runWorkflow: Object.freeze({
    enabled: false,
    minItems: 10,
  }),
  swarm: Object.freeze({
    enabled: false,
    minModules: 3,
  }),
  browser: Object.freeze({
    enabled: true,
  }),
  generativeUi: Object.freeze({
    enabled: true,
  }),
  boost: Object.freeze({
    enabled: true,
    minFailedAttempts: 3,
  }),
  goal: Object.freeze({
    enabled: true,
  }),
  teamwork: Object.freeze({
    enabled: false,
  }),
  compact: Object.freeze({
    enabled: true,
    minTurns: 30,
  }),
});

export const PRESETS = Object.freeze({
  off: Object.freeze({
    masterEnabled: false,
    ...BALANCED_FEATURES,
  }),
  direct: Object.freeze({
    masterEnabled: true,
    plan: Object.freeze({
      enabled: true,
      minFiles: 8,
      triggerOnArchChange: false,
    }),
    grillMe: Object.freeze({
      enabled: true,
      strictness: 'relaxed',
      maxQuestions: 2,
    }),
    runWorkflow: Object.freeze({
      enabled: false,
      minItems: 15,
    }),
    swarm: Object.freeze({
      enabled: false,
      minModules: 4,
    }),
    browser: Object.freeze({
      enabled: true,
    }),
    generativeUi: Object.freeze({
      enabled: false,
    }),
    boost: Object.freeze({
      enabled: true,
      minFailedAttempts: 4,
    }),
    goal: Object.freeze({
      enabled: true,
    }),
    teamwork: Object.freeze({
      enabled: false,
    }),
    compact: Object.freeze({
      enabled: true,
      minTurns: 40,
    }),
  }),
  balanced: Object.freeze({
    masterEnabled: true,
    ...BALANCED_FEATURES,
  }),
  strict: Object.freeze({
    masterEnabled: true,
    plan: Object.freeze({
      enabled: true,
      minFiles: 3,
      triggerOnArchChange: true,
    }),
    grillMe: Object.freeze({
      enabled: true,
      strictness: 'standard',
      maxQuestions: 5,
    }),
    runWorkflow: Object.freeze({
      enabled: true,
      minItems: 5,
    }),
    swarm: Object.freeze({
      enabled: true,
      minModules: 2,
    }),
    browser: Object.freeze({
      enabled: true,
    }),
    generativeUi: Object.freeze({
      enabled: true,
    }),
    boost: Object.freeze({
      enabled: true,
      minFailedAttempts: 2,
    }),
    goal: Object.freeze({
      enabled: true,
    }),
    teamwork: Object.freeze({
      enabled: true,
    }),
    compact: Object.freeze({
      enabled: true,
      minTurns: 20,
    }),
  }),
});

export const PRESET_META = Object.freeze([
  Object.freeze({
    id: 'off',
    label: '零打扰',
    summary: '暂停全局自动路由，仅作指令速查面板（保留下方参数）',
  }),
  Object.freeze({
    id: 'direct',
    label: '直干优先',
    summary: 'Plan ≥ 8 文件且不因架构强制中断，重型多智能体关闭',
  }),
  Object.freeze({
    id: 'balanced',
    label: '均衡克制',
    summary: 'Plan ≥ 6 文件，高耗额度的 swarm/run_workflow 默认关闭',
  }),
  Object.freeze({
    id: 'strict',
    label: '严谨架构',
    summary: 'Plan ≥ 3 文件，全量开启多智能体协同与前端提醒',
  }),
]);

export const DEFAULT_SETTINGS = Object.freeze({
  masterEnabled: false,
  activePreset: 'off',
  ...BALANCED_FEATURES,
});

function clampInt(value, { min, max, step = 1 }, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.min(max, Math.max(min, num));
  if (step > 1) {
    const stepped = Math.round((clamped - min) / step) * step + min;
    return Math.min(max, Math.max(min, stepped));
  }
  return Math.round(clamped);
}

function asBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function asEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function cloneFeatures(source) {
  return {
    plan: { ...source.plan },
    grillMe: { ...source.grillMe },
    runWorkflow: { ...source.runWorkflow },
    swarm: { ...source.swarm },
    browser: { ...source.browser },
    generativeUi: { ...source.generativeUi },
    boost: { ...source.boost },
    goal: { ...source.goal },
    teamwork: { ...source.teamwork },
    compact: { ...source.compact },
  };
}

function featuresMatch(a, b) {
  return (
    a.plan.enabled === b.plan.enabled &&
    a.plan.minFiles === b.plan.minFiles &&
    a.plan.triggerOnArchChange === b.plan.triggerOnArchChange &&
    a.grillMe.enabled === b.grillMe.enabled &&
    a.grillMe.strictness === b.grillMe.strictness &&
    a.grillMe.maxQuestions === b.grillMe.maxQuestions &&
    a.runWorkflow.enabled === b.runWorkflow.enabled &&
    a.runWorkflow.minItems === b.runWorkflow.minItems &&
    a.swarm.enabled === b.swarm.enabled &&
    a.swarm.minModules === b.swarm.minModules &&
    a.browser.enabled === b.browser.enabled &&
    a.generativeUi.enabled === b.generativeUi.enabled &&
    a.boost.enabled === b.boost.enabled &&
    a.boost.minFailedAttempts === b.boost.minFailedAttempts &&
    a.goal.enabled === b.goal.enabled &&
    a.teamwork.enabled === b.teamwork.enabled &&
    a.compact.enabled === b.compact.enabled &&
    a.compact.minTurns === b.compact.minTurns
  );
}

/**
 * Determine which preset ID matches the given normalized settings object.
 */
export function detectPreset(settings) {
  if (!settings.masterEnabled) return 'off';
  for (const id of ['direct', 'balanced', 'strict']) {
    if (featuresMatch(settings, PRESETS[id])) return id;
  }
  return 'custom';
}

/**
 * Normalize partial or untrusted settings input against a valid base object,
 * clamping all numeric slider bounds and recomputing activePreset.
 */
export function normalizeSettings(input, base = DEFAULT_SETTINGS) {
  const safeBase = base && typeof base === 'object' ? base : DEFAULT_SETTINGS;
  const raw = input && typeof input === 'object' ? input : {};

  const planIn = raw.plan && typeof raw.plan === 'object' ? raw.plan : {};
  const grillIn = raw.grillMe && typeof raw.grillMe === 'object' ? raw.grillMe : {};
  const wfIn = raw.runWorkflow && typeof raw.runWorkflow === 'object' ? raw.runWorkflow : {};
  const swarmIn = raw.swarm && typeof raw.swarm === 'object' ? raw.swarm : {};
  const browserIn = raw.browser && typeof raw.browser === 'object' ? raw.browser : {};
  const genUiIn = raw.generativeUi && typeof raw.generativeUi === 'object' ? raw.generativeUi : {};
  const boostIn = raw.boost && typeof raw.boost === 'object' ? raw.boost : {};
  const goalIn = raw.goal && typeof raw.goal === 'object' ? raw.goal : {};
  const teamworkIn = raw.teamwork && typeof raw.teamwork === 'object' ? raw.teamwork : {};
  const compactIn = raw.compact && typeof raw.compact === 'object' ? raw.compact : {};

  const normalized = {
    masterEnabled: asBool(raw.masterEnabled, safeBase.masterEnabled),
    activePreset: 'off',
    plan: {
      enabled: asBool(planIn.enabled, safeBase.plan.enabled),
      minFiles: clampInt(planIn.minFiles, LIMITS.planMinFiles, safeBase.plan.minFiles),
      triggerOnArchChange: asBool(
        planIn.triggerOnArchChange,
        safeBase.plan.triggerOnArchChange
      ),
    },
    grillMe: {
      enabled: asBool(grillIn.enabled, safeBase.grillMe.enabled),
      strictness: asEnum(
        grillIn.strictness,
        LIMITS.grillMeStrictness,
        safeBase.grillMe.strictness
      ),
      maxQuestions: clampInt(
        grillIn.maxQuestions,
        LIMITS.grillMeMaxQuestions,
        safeBase.grillMe.maxQuestions
      ),
    },
    runWorkflow: {
      enabled: asBool(wfIn.enabled, safeBase.runWorkflow.enabled),
      minItems: clampInt(
        wfIn.minItems,
        LIMITS.runWorkflowMinItems,
        safeBase.runWorkflow.minItems
      ),
    },
    swarm: {
      enabled: asBool(swarmIn.enabled, safeBase.swarm.enabled),
      minModules: clampInt(
        swarmIn.minModules,
        LIMITS.swarmMinModules,
        safeBase.swarm.minModules
      ),
    },
    browser: {
      enabled: asBool(browserIn.enabled, safeBase.browser.enabled),
    },
    generativeUi: {
      enabled: asBool(genUiIn.enabled, safeBase.generativeUi.enabled),
    },
    boost: {
      enabled: asBool(boostIn.enabled, safeBase.boost.enabled),
      minFailedAttempts: clampInt(
        boostIn.minFailedAttempts,
        LIMITS.boostMinFailedAttempts,
        safeBase.boost.minFailedAttempts
      ),
    },
    goal: {
      enabled: asBool(goalIn.enabled, safeBase.goal.enabled),
    },
    teamwork: {
      enabled: asBool(teamworkIn.enabled, safeBase.teamwork.enabled),
    },
    compact: {
      enabled: asBool(compactIn.enabled, safeBase.compact.enabled),
      minTurns: clampInt(
        compactIn.minTurns,
        LIMITS.compactMinTurns,
        safeBase.compact.minTurns
      ),
    },
  };

  normalized.activePreset = detectPreset(normalized);
  return normalized;
}

/**
 * Apply one of the named presets ('off' | 'direct' | 'balanced' | 'strict').
 * Applying 'off' preserves existing slider/toggle values while setting masterEnabled to false.
 */
export function applyPreset(currentSettings, presetId) {
  const base = normalizeSettings(currentSettings, DEFAULT_SETTINGS);
  if (presetId === 'off') {
    return {
      ...cloneFeatures(base),
      masterEnabled: false,
      activePreset: 'off',
    };
  }
  const preset = PRESETS[presetId];
  if (!preset) {
    throw new Error(`未知预设档位: ${presetId}`);
  }
  return {
    ...cloneFeatures(preset),
    masterEnabled: true,
    activePreset: presetId,
  };
}

export function getSettingsPath(pluginRoot) {
  return join(pluginRoot, 'data', 'settings.json');
}

/**
 * Atomically write text to a file by staging a temp file in the same directory.
 */
export function atomicWriteFile(filePath, content) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = join(
    dir,
    `.${basename(filePath)}.${process.pid}.${Date.now()}.${Math.random()
      .toString(16)
      .slice(2)}.tmp`
  );
  try {
    writeFileSync(tmpPath, content, 'utf8');
    renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}

export function loadSettings(pluginRoot) {
  const filePath = getSettingsPath(pluginRoot);
  if (!existsSync(filePath)) {
    return normalizeSettings(DEFAULT_SETTINGS, DEFAULT_SETTINGS);
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    return normalizeSettings(raw, DEFAULT_SETTINGS);
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS, DEFAULT_SETTINGS);
  }
}

export function saveSettings(pluginRoot, settings) {
  const normalized = normalizeSettings(settings, DEFAULT_SETTINGS);
  const filePath = getSettingsPath(pluginRoot);
  atomicWriteFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}
