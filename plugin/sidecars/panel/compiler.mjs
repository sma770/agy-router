import { join } from 'node:path';
import { atomicWriteFile, normalizeSettings, PRESET_META } from './config.mjs';

export const MAX_RULE_BYTES = 24000;

const STRICTNESS_DESCRIPTIONS = {
  relaxed:
    '宽松模式：仅当核心业务目标、关键数据流或交付形式完全缺失、无法直接开工时才触发追问',
  standard:
    '标准模式：当核心规则、边界条件或关键接口契约未定，猜错返工成本较高时触发追问',
  strict:
    '严谨模式：凡新功能、新工具或较大重构在核心方案与验收标准未完全对齐前，均先追问确认',
};

function presetLabelOf(id) {
  const item = PRESET_META.find((p) => p.id === id);
  return item ? item.label : '自定义';
}

export function getRulesPath(pluginRoot) {
  return join(pluginRoot, 'rules', 'AGENTS.md');
}

/**
 * Pure compiler turning settings into plain Markdown rules (no YAML frontmatter).
 */
export function compileAgentsMarkdown(rawSettings) {
  const s = normalizeSettings(rawSettings);

  if (!s.masterEnabled) {
    const markdown = [
      '# AGY 智能路由台全局规则（当前已暂停）',
      '',
      '当前全局自动路由总开关处于**关闭（零打扰）**状态。请严格按 Google Antigravity 2.0 桌面端 App 默认行为执行任务，不主动插入额外追问、强制 Plan 拦截或前端斜杠指令提醒。',
      '',
      '仅当用户主动调用 `/agy-router`、询问指令选型对比，或要求打开/调整路由控制台时，再提供 `[AGY 智能路由台](sidecar://agy-router/panel/)` 面板入口与选型建议。',
      '',
    ].join('\n');
    const bytes = Buffer.byteLength(markdown, 'utf8');
    return {
      markdown,
      bytes,
      maxBytes: MAX_RULE_BYTES,
      usagePercent: Number(((bytes / MAX_RULE_BYTES) * 100).toFixed(2)),
      enabledCount: 0,
      masterEnabled: false,
      activePreset: s.activePreset,
    };
  }

  const lines = [
    `# AGY 智能路由台全局规则（当前档位：${presetLabelOf(s.activePreset)}）`,
    '',
    '本规则仅适用于 **Google Antigravity 2.0 桌面端 App**。若当前项目工作区已存在更具体的本地 `AGENTS.md` / `GEMINI.md` 流程约束，以项目级规范优先。',
    '',
    '## 一、轻量任务免打扰白名单（直接执行，零额外弹窗）',
    '',
  ];

  const smallFileBound = s.plan.enabled
    ? Math.max(1, s.plan.minFiles - 1)
    : 2;

  lines.push(
    s.plan.enabled
      ? `凡预计改动 **1～${smallFileBound} 个文件**的明确局部修改${s.plan.triggerOnArchChange ? '（且不涉及公共接口或核心架构变动）' : ''}、代码解释、常规单次报错修复，以及可用 \`rg\` 或简短本地命令秒级完成的确定性查找，**直接干脆执行**，禁止强行创建计划文档或推销斜杠指令。`
      : '凡目标明确的局部代码修改、代码解释、常规单次报错修复，以及可用 `rg` 或简短本地命令秒级完成的确定性查找，**直接干脆执行**，不主动强插额外规划或追问。'
  );

  lines.push('', '## 二、原生底层能力自动代执行（无需用户手敲斜杠）', '');

  const trackA = [];

  if (s.plan.enabled) {
    const archClause = s.plan.triggerOnArchChange
      ? '，或涉及调整公共接口 / 核心架构时'
      : '时（仅因跨文件规模触发，局部小架构调整不额外拦截）';
    trackA.push(
      `- **自动先出方案（Plan）**：当任务目标已明确，但预计改动 **${s.plan.minFiles} 个及以上**源文件${archClause}，先只读扫描相关代码与依赖，在产物目录创建带 \`RequestFeedback: true\` 的 \`Implementation Plan\` 实施方案，获用户批准后再修改业务文件。`
    );
  }

  if (s.grillMe.enabled) {
    const strictText =
      STRICTNESS_DESCRIPTIONS[s.grillMe.strictness] ||
      STRICTNESS_DESCRIPTIONS.relaxed;
    trackA.push(
      `- **模糊需求单题追问（Grill-Me）**：${strictText}。禁止臆测硬写代码或一次抛出一长串问卷；调用 \`ask_question\` 每次只问 **1 个**最关键决策问题并置顶 \`(Recommended)\` 推荐项，**最多连续追问 ${s.grillMe.maxQuestions} 轮**，关键前提对齐后立即推进实施。`
    );
  }

  if (s.runWorkflow.enabled) {
    trackA.push(
      `- **大批量同质语义任务并发（run_workflow）**：当需要对 **${s.runWorkflow.minItems} 个及以上**独立文件、模块或子目录执行依赖大模型语义理解的同质检查或改造时，先读取内置 \`run-workflow\` Skill，再调用 \`run_workflow\` 工具编写 Python \`parallel()\` / \`pipeline()\` 脚本并发处理（纯字符或正则匹配仍用本地命令直接完成）。`
    );
  }

  if (s.swarm.enabled) {
    trackA.push(
      `- **多模块并行协作与验收（swarm）**：当任务天然拆分为 **${s.swarm.minModules} 个及以上**互不冲突的独立模块需要并行开发并由专人验收时，读取内置 \`swarm\` Skill 使用 \`swarm\` 工具协调 Worker 与 Verifier。`
    );
  }

  if (s.browser.enabled) {
    trackA.push(
      '- **动态网页实操（browser）**：涉及真实网页点击、表单交互、动态渲染页面查验或前端 UI 截图核对时，直接委派 `browser` 子智能体执行。'
    );
  }

  if (s.generativeUi.enabled) {
    trackA.push(
      '- **交互式可视化呈现（generative_ui）**：当向用户讲解复杂架构拓扑、数据对比或需要交互式演示控件时，读取内置 `generative_ui` Skill 渲染交互视图。'
    );
  }

  if (trackA.length === 0) {
    lines.push('当前未启用任何原生底层自动代执行规则。');
  } else {
    lines.push(...trackA);
  }

  lines.push('', '## 三、前端专属指令首行提醒（不阻断当前排查，严守 App 边界）', '');

  const trackB = [];

  if (s.boost.enabled) {
    trackB.push(
      `- **疑难故障多假设深挖（\`/boost\`）**：当同一疑难 Bug 已连续尝试修复 **${s.boost.minFailedAttempts} 次及以上**仍未解决，或遇到偶发并发死锁、竞态条件与复杂算法性能瓶颈时，在正常继续排查的同时，于回复**第 1 行**附上一句可复制的 \`/boost <精炼问题描述>\`（注明需付费计划）。`
    );
  }

  if (s.goal.enabled) {
    trackB.push(
      '- **长闭环死磕到底（`/goal`）**：当用户明确要求“修通全部报错与测试为止、中途不要停下确认”时，在全力推进修复的同时，于回复**第 1 行**附上一句可复制的 `/goal <精炼验收目标>`。'
    );
  }

  if (s.teamwork.enabled) {
    trackB.push(
      '- **仓库级大迁移（`/teamwork`）**：遇到跨天级框架大迁移或核心子系统重写时，于回复**第 1 行**附上一句可复制的 `/teamwork <迁移目标>`（注明需付费计划）。'
    );
  }

  if (s.compact.enabled) {
    trackB.push(
      `- **长对话浓缩瘦身（\`/compact\`）**：当同一会话持续超过约 **${s.compact.minTurns} 轮**或上下文明显变慢、接近上限时，于回复**第 1 行**简短提醒可输入 \`/compact\` 浓缩历史上下文。`
    );
  }

  if (trackB.length === 0) {
    lines.push('当前未启用任何前端斜杠指令首行提醒。');
  } else {
    lines.push(...trackB);
  }

  lines.push(
    '',
    '## 四、平台边界与控制台入口',
    '',
    '- 严禁推荐或提及任何终端 `agy` CLI 专属指令（如 `/undo`、`/rewind`、`/branch`、`/fork`、`/clear`、`/new`、`/resume`、`/switch`、`/effort`、`/codesearch`、`/diff`、`/statusline`、`/title`、`/voice`、`/exit`）及 IDE 专属功能。',
    '- 当用户询问指令选型或想要调整上述阈值与开关时，加载 `agy-router` Skill 并提供右侧辅助面板入口 `[AGY 智能路由台](sidecar://agy-router/panel/)`。',
    ''
  );

  const markdown = lines.join('\n');
  const bytes = Buffer.byteLength(markdown, 'utf8');
  const enabledCount = [
    s.plan.enabled,
    s.grillMe.enabled,
    s.runWorkflow.enabled,
    s.swarm.enabled,
    s.browser.enabled,
    s.generativeUi.enabled,
    s.boost.enabled,
    s.goal.enabled,
    s.teamwork.enabled,
    s.compact.enabled,
  ].filter(Boolean).length;

  return {
    markdown,
    bytes,
    maxBytes: MAX_RULE_BYTES,
    usagePercent: Number(((bytes / MAX_RULE_BYTES) * 100).toFixed(2)),
    enabledCount,
    masterEnabled: true,
    activePreset: s.activePreset,
  };
}

export function compileAndWriteRules(pluginRoot, settings) {
  const compiled = compileAgentsMarkdown(settings);
  if (compiled.bytes > MAX_RULE_BYTES) {
    throw new Error(
      `编译后的 AGENTS.md 超过 ${MAX_RULE_BYTES} 字节限制（当前 ${compiled.bytes} 字节）`
    );
  }
  const rulesPath = getRulesPath(pluginRoot);
  atomicWriteFile(rulesPath, compiled.markdown);
  return {
    ...compiled,
    rulesPath,
  };
}
