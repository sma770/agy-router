const apiFetch = (url, options = {}) => {
  if (window.sidecar && typeof window.sidecar.fetch === 'function') {
    return window.sidecar.fetch(url, options);
  }
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
};

const state = {
  data: null,
  commandsData: null,
  activeCategory: 'all',
  searchQuery: '',
  saveTimer: null,
};

const el = {
  masterEnabled: document.getElementById('masterEnabled'),
  statusBadge: document.getElementById('statusBadge'),
  customPresetChip: document.getElementById('customPresetChip'),
  presetGrid: document.getElementById('presetGrid'),
  presetDesc: document.getElementById('presetDesc'),
  pausedBanner: document.getElementById('pausedBanner'),
  groupsWrap: document.getElementById('groupsWrap'),
  saveStatus: document.getElementById('saveStatus'),
  resetBtn: document.getElementById('resetBtn'),

  planEnabled: document.getElementById('planEnabled'),
  planSub: document.getElementById('planSub'),
  planMinFiles: document.getElementById('planMinFiles'),
  planMinFilesVal: document.getElementById('planMinFilesVal'),
  whitelistHint: document.getElementById('whitelistHint'),
  planTriggerArch: document.getElementById('planTriggerArch'),

  grillEnabled: document.getElementById('grillEnabled'),
  grillSub: document.getElementById('grillSub'),
  grillStrictnessGroup: document.getElementById('grillStrictnessGroup'),
  grillMaxQuestions: document.getElementById('grillMaxQuestions'),
  grillMaxQuestionsVal: document.getElementById('grillMaxQuestionsVal'),

  workflowEnabled: document.getElementById('workflowEnabled'),
  workflowSub: document.getElementById('workflowSub'),
  workflowMinItems: document.getElementById('workflowMinItems'),
  workflowMinItemsVal: document.getElementById('workflowMinItemsVal'),

  swarmEnabled: document.getElementById('swarmEnabled'),
  swarmSub: document.getElementById('swarmSub'),
  swarmMinModules: document.getElementById('swarmMinModules'),
  swarmMinModulesVal: document.getElementById('swarmMinModulesVal'),

  browserEnabled: document.getElementById('browserEnabled'),
  genUiEnabled: document.getElementById('genUiEnabled'),

  boostEnabled: document.getElementById('boostEnabled'),
  boostSub: document.getElementById('boostSub'),
  boostMinAttempts: document.getElementById('boostMinAttempts'),
  boostMinAttemptsVal: document.getElementById('boostMinAttemptsVal'),

  goalEnabled: document.getElementById('goalEnabled'),
  teamworkEnabled: document.getElementById('teamworkEnabled'),

  compactEnabled: document.getElementById('compactEnabled'),
  compactSub: document.getElementById('compactSub'),
  compactMinTurns: document.getElementById('compactMinTurns'),
  compactMinTurnsVal: document.getElementById('compactMinTurnsVal'),

  commandSearch: document.getElementById('commandSearch'),
  categoryChips: document.getElementById('categoryChips'),
  commandList: document.getElementById('commandList'),
  comparisonsWrap: document.getElementById('comparisonsWrap'),
  desktopNotesWrap: document.getElementById('desktopNotesWrap'),

  previewStatsText: document.getElementById('previewStatsText'),
  previewProgressBar: document.getElementById('previewProgressBar'),
  previewEnabledSummary: document.getElementById('previewEnabledSummary'),
  rulesPreviewCode: document.getElementById('rulesPreviewCode'),
  rulesPathText: document.getElementById('rulesPathText'),
  settingsPathText: document.getElementById('settingsPathText'),
  copyRulesBtn: document.getElementById('copyRulesBtn'),
};

async function copyText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to textarea fallback inside sandboxed iframes
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function flashCopied(button, defaultText) {
  button.textContent = '已复制';
  button.classList.add('is-copied');
  setTimeout(() => {
    button.textContent = defaultText;
    button.classList.remove('is-copied');
  }, 1500);
}

function setSaveStatus(text, isError = false) {
  el.saveStatus.textContent = text;
  el.saveStatus.classList.toggle('is-error', isError);
}

function toggleSubControl(container, enabled) {
  container.classList.toggle('is-disabled', !enabled);
  for (const input of container.querySelectorAll('input, button')) {
    input.disabled = !enabled;
  }
}

function renderState() {
  if (!state.data) return;
  const { settings, presets, compiled, paths } = state.data;

  el.masterEnabled.checked = settings.masterEnabled;
  el.pausedBanner.hidden = settings.masterEnabled;
  el.groupsWrap.classList.toggle('is-paused', !settings.masterEnabled);

  const activeMeta = presets.find((p) => p.id === settings.activePreset);
  if (!settings.masterEnabled) {
    el.statusBadge.textContent = '已暂停';
    el.statusBadge.className = 'status-badge is-off';
  } else {
    const label = activeMeta ? activeMeta.label : '自定义';
    el.statusBadge.textContent = `运行中 · ${label}`;
    el.statusBadge.className = 'status-badge is-on';
  }

  el.customPresetChip.hidden = settings.activePreset !== 'custom';
  for (const btn of el.presetGrid.querySelectorAll('.preset-btn')) {
    btn.classList.toggle('is-active', btn.dataset.preset === settings.activePreset);
  }
  el.presetDesc.textContent = activeMeta
    ? activeMeta.summary
    : '已手动调整开关或滑块阈值（可随时点击上方预设恢复标准档位）';

  // Plan
  el.planEnabled.checked = settings.plan.enabled;
  el.planMinFiles.value = String(settings.plan.minFiles);
  el.planMinFilesVal.textContent = `${settings.plan.minFiles} 个`;
  el.planTriggerArch.checked = settings.plan.triggerOnArchChange;
  el.whitelistHint.textContent = settings.plan.enabled
    ? `当前免打扰白名单：1～${Math.max(1, settings.plan.minFiles - 1)} 个文件的局部修改直接执行`
    : '自动 Plan 已关闭：除明确要求外，局部修改不主动拦截';
  toggleSubControl(el.planSub, settings.plan.enabled);

  // Grill-Me
  el.grillEnabled.checked = settings.grillMe.enabled;
  el.grillMaxQuestions.value = String(settings.grillMe.maxQuestions);
  el.grillMaxQuestionsVal.textContent = `${settings.grillMe.maxQuestions} 轮`;
  for (const btn of el.grillStrictnessGroup.querySelectorAll('.seg-btn')) {
    btn.classList.toggle('is-active', btn.dataset.strictness === settings.grillMe.strictness);
  }
  toggleSubControl(el.grillSub, settings.grillMe.enabled);

  // run_workflow
  el.workflowEnabled.checked = settings.runWorkflow.enabled;
  el.workflowMinItems.value = String(settings.runWorkflow.minItems);
  el.workflowMinItemsVal.textContent = `${settings.runWorkflow.minItems} 个`;
  toggleSubControl(el.workflowSub, settings.runWorkflow.enabled);

  // swarm
  el.swarmEnabled.checked = settings.swarm.enabled;
  el.swarmMinModules.value = String(settings.swarm.minModules);
  el.swarmMinModulesVal.textContent = `${settings.swarm.minModules} 个`;
  toggleSubControl(el.swarmSub, settings.swarm.enabled);

  // tools
  el.browserEnabled.checked = settings.browser.enabled;
  el.genUiEnabled.checked = settings.generativeUi.enabled;

  // boost
  el.boostEnabled.checked = settings.boost.enabled;
  el.boostMinAttempts.value = String(settings.boost.minFailedAttempts);
  el.boostMinAttemptsVal.textContent = `${settings.boost.minFailedAttempts} 次`;
  toggleSubControl(el.boostSub, settings.boost.enabled);

  // goal & teamwork
  el.goalEnabled.checked = settings.goal.enabled;
  el.teamworkEnabled.checked = settings.teamwork.enabled;

  // compact
  el.compactEnabled.checked = settings.compact.enabled;
  el.compactMinTurns.value = String(settings.compact.minTurns);
  el.compactMinTurnsVal.textContent = `${settings.compact.minTurns} 轮`;
  toggleSubControl(el.compactSub, settings.compact.enabled);

  // Preview tab
  el.previewStatsText.textContent = `${compiled.bytes} / ${compiled.maxBytes} 字节 (${compiled.usagePercent}%)`;
  el.previewProgressBar.style.width = `${Math.min(100, Math.max(1, compiled.usagePercent))}%`;
  el.previewEnabledSummary.textContent = compiled.masterEnabled
    ? `当前已开启 ${compiled.enabledCount} 项路由规则，修改配置后从下一对话回合起生效`
    : '当前总开关已关闭：rules/AGENTS.md 处于零打扰占位状态';
  el.rulesPreviewCode.textContent = compiled.markdown;
  el.rulesPathText.textContent = paths.rulesPath;
  el.settingsPathText.textContent = paths.settingsPath;
}

function collectSettingsFromUI() {
  const activeSeg = el.grillStrictnessGroup.querySelector('.seg-btn.is-active');
  return {
    masterEnabled: el.masterEnabled.checked,
    plan: {
      enabled: el.planEnabled.checked,
      minFiles: Number(el.planMinFiles.value),
      triggerOnArchChange: el.planTriggerArch.checked,
    },
    grillMe: {
      enabled: el.grillEnabled.checked,
      strictness: activeSeg ? activeSeg.dataset.strictness : 'relaxed',
      maxQuestions: Number(el.grillMaxQuestions.value),
    },
    runWorkflow: {
      enabled: el.workflowEnabled.checked,
      minItems: Number(el.workflowMinItems.value),
    },
    swarm: {
      enabled: el.swarmEnabled.checked,
      minModules: Number(el.swarmMinModules.value),
    },
    browser: {
      enabled: el.browserEnabled.checked,
    },
    generativeUi: {
      enabled: el.genUiEnabled.checked,
    },
    boost: {
      enabled: el.boostEnabled.checked,
      minFailedAttempts: Number(el.boostMinAttempts.value),
    },
    goal: {
      enabled: el.goalEnabled.checked,
    },
    teamwork: {
      enabled: el.teamworkEnabled.checked,
    },
    compact: {
      enabled: el.compactEnabled.checked,
      minTurns: Number(el.compactMinTurns.value),
    },
  };
}

async function persistSettingsNow() {
  const payload = collectSettingsFromUI();
  setSaveStatus('保存并编译规则中...');
  try {
    const res = await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || '保存失败');
    state.data = body;
    renderState();
    setSaveStatus('已自动保存 · 下个回合起生效');
  } catch (err) {
    setSaveStatus(`保存失败：${err.message}`, true);
  }
}

function scheduleSave(immediate = false) {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  if (immediate) {
    void persistSettingsNow();
    return;
  }
  setSaveStatus('待保存...');
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    void persistSettingsNow();
  }, 250);
}

async function applyPresetRequest(presetId) {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  setSaveStatus('正在切换预设...');
  try {
    const res = await apiFetch('/api/preset', {
      method: 'POST',
      body: JSON.stringify({ presetId }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || '切换预设失败');
    state.data = body;
    renderState();
    setSaveStatus('预设已生效 · 下个回合起生效');
  } catch (err) {
    setSaveStatus(`切换失败：${err.message}`, true);
  }
}

async function resetSettingsRequest() {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  setSaveStatus('正在恢复默认...');
  try {
    const res = await apiFetch('/api/reset', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || '重置失败');
    state.data = body;
    renderState();
    setSaveStatus('已恢复初始零打扰配置');
  } catch (err) {
    setSaveStatus(`重置失败：${err.message}`, true);
  }
}

function renderCommands() {
  if (!state.commandsData) return;
  const { categories, commands, comparisons, desktopNotes } = state.commandsData;

  el.categoryChips.replaceChildren();
  for (const cat of categories) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-chip${state.activeCategory === cat.id ? ' is-active' : ''}`;
    btn.textContent = cat.label;
    btn.addEventListener('click', () => {
      state.activeCategory = cat.id;
      renderCommands();
    });
    el.categoryChips.appendChild(btn);
  }

  const query = state.searchQuery.trim().toLowerCase();
  const filtered = commands.filter((cmd) => {
    if (state.activeCategory !== 'all' && cmd.category !== state.activeCategory) {
      return false;
    }
    if (!query) return true;
    const haystack = [
      cmd.name,
      cmd.summary,
      cmd.whenToUse,
      cmd.categoryLabel,
      ...cmd.keywords,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  el.commandList.replaceChildren();
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '未找到匹配的指令，换个关键字试试。';
    el.commandList.appendChild(empty);
  } else {
    for (const cmd of filtered) {
      const card = document.createElement('article');
      card.className = 'cmd-card';

      const top = document.createElement('div');
      top.className = 'cmd-card-top';

      const nameWrap = document.createElement('div');
      nameWrap.className = 'cmd-name-wrap';

      const nameEl = document.createElement('span');
      nameEl.className = 'cmd-name';
      nameEl.textContent = cmd.name;
      nameWrap.appendChild(nameEl);

      if (cmd.tier !== '全部套餐') {
        const tierEl = document.createElement('span');
        tierEl.className = 'tier-badge is-pro';
        tierEl.textContent = cmd.tier;
        nameWrap.appendChild(tierEl);
      }

      if (cmd.appOnly) {
        const appEl = document.createElement('span');
        appEl.className = 'tier-badge is-app';
        appEl.textContent = 'App 专属';
        nameWrap.appendChild(appEl);
      }

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = '复制模板';
      copyBtn.addEventListener('click', async () => {
        const ok = await copyText(cmd.template);
        if (ok) flashCopied(copyBtn, '复制模板');
      });

      top.appendChild(nameWrap);
      top.appendChild(copyBtn);

      const summaryEl = document.createElement('p');
      summaryEl.className = 'cmd-summary';
      summaryEl.textContent = cmd.summary;

      const whenEl = document.createElement('p');
      whenEl.className = 'cmd-when';
      whenEl.textContent = `适用：${cmd.whenToUse}`;

      const tmplEl = document.createElement('pre');
      tmplEl.className = 'cmd-template';
      tmplEl.textContent = cmd.template;

      card.append(top, summaryEl, whenEl, tmplEl);
      el.commandList.appendChild(card);
    }
  }

  if (el.comparisonsWrap.childElementCount === 0) {
    for (const item of comparisons) {
      const block = document.createElement('div');
      block.className = 'matrix-block';
      const title = document.createElement('div');
      title.className = 'matrix-title';
      title.textContent = item.title;
      const table = document.createElement('table');
      table.className = 'matrix-table';
      for (const row of item.rows) {
        const tr = document.createElement('tr');
        for (const cell of row) {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        }
        table.appendChild(tr);
      }
      block.append(title, table);
      el.comparisonsWrap.appendChild(block);
    }

    for (const note of desktopNotes) {
      const box = document.createElement('div');
      box.className = 'note-item';
      const strong = document.createElement('strong');
      strong.textContent = note.question;
      const span = document.createElement('span');
      span.textContent = note.answer;
      box.append(strong, span);
      el.desktopNotesWrap.appendChild(box);
    }
  }
}

function bindEvents() {
  // Tabs
  for (const tabBtn of document.querySelectorAll('.tab-btn')) {
    tabBtn.addEventListener('click', () => {
      const target = tabBtn.dataset.tab;
      for (const b of document.querySelectorAll('.tab-btn')) {
        const active = b.dataset.tab === target;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      }
      for (const panel of document.querySelectorAll('.tab-panel')) {
        const active = panel.id === `panel-${target}`;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      }
    });
  }

  // Presets
  for (const btn of el.presetGrid.querySelectorAll('.preset-btn')) {
    btn.addEventListener('click', () => {
      void applyPresetRequest(btn.dataset.preset);
    });
  }

  // Immediate toggles
  for (const checkbox of [
    el.masterEnabled,
    el.planEnabled,
    el.planTriggerArch,
    el.grillEnabled,
    el.workflowEnabled,
    el.swarmEnabled,
    el.browserEnabled,
    el.genUiEnabled,
    el.boostEnabled,
    el.goalEnabled,
    el.teamworkEnabled,
    el.compactEnabled,
  ]) {
    checkbox.addEventListener('change', () => {
      if (state.data) {
        Object.assign(state.data.settings, collectSettingsFromUI());
        renderState();
      }
      scheduleSave(true);
    });
  }

  // Strictness segmented buttons
  for (const segBtn of el.grillStrictnessGroup.querySelectorAll('.seg-btn')) {
    segBtn.addEventListener('click', () => {
      for (const b of el.grillStrictnessGroup.querySelectorAll('.seg-btn')) {
        b.classList.toggle('is-active', b === segBtn);
      }
      scheduleSave(true);
    });
  }

  // Sliders (live display + debounced save)
  const sliderBindings = [
    [el.planMinFiles, el.planMinFilesVal, '个', true],
    [el.grillMaxQuestions, el.grillMaxQuestionsVal, '轮', false],
    [el.workflowMinItems, el.workflowMinItemsVal, '个', false],
    [el.swarmMinModules, el.swarmMinModulesVal, '个', false],
    [el.boostMinAttempts, el.boostMinAttemptsVal, '次', false],
    [el.compactMinTurns, el.compactMinTurnsVal, '轮', false],
  ];

  for (const [input, badge, unit, updatesWhitelist] of sliderBindings) {
    input.addEventListener('input', () => {
      badge.textContent = `${input.value} ${unit}`;
      if (updatesWhitelist) {
        const count = Math.max(1, Number(input.value) - 1);
        el.whitelistHint.textContent = `当前免打扰白名单：1～${count} 个文件的局部修改直接执行`;
      }
      scheduleSave(false);
    });
  }

  el.resetBtn.addEventListener('click', () => {
    void resetSettingsRequest();
  });

  el.commandSearch.addEventListener('input', () => {
    state.searchQuery = el.commandSearch.value;
    renderCommands();
  });

  el.copyRulesBtn.addEventListener('click', async () => {
    if (!state.data?.compiled?.markdown) return;
    const ok = await copyText(state.data.compiled.markdown);
    if (ok) flashCopied(el.copyRulesBtn, '复制规则文本');
  });
}

async function init() {
  bindEvents();
  try {
    const [stateRes, cmdRes] = await Promise.all([
      apiFetch('/api/state'),
      apiFetch('/api/commands'),
    ]);
    if (!stateRes.ok) throw new Error('无法读取路由配置状态');
    if (!cmdRes.ok) throw new Error('无法读取指令速查列表');
    state.data = await stateRes.json();
    state.commandsData = await cmdRes.json();
    renderState();
    renderCommands();
    setSaveStatus('已同步');
  } catch (err) {
    setSaveStatus(`初始化失败：${err.message}`, true);
  }
}

void init();
