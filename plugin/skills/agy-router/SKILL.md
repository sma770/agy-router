---
name: agy-router
description: 专为 Google Antigravity 2.0 桌面端 App 打造的路由控制台与内置斜杠指令参谋。当用户想打开 AGY 智能路由台面板调节阈值或查看规则状态、询问某个任务该用哪个 Antigravity App 内置斜杠指令、或对比相近指令（如 /grill-me 与 /plan、/schedule 与 /automation、/goal 与 /boost）时使用；严格屏蔽终端 agy CLI 专属指令与 IDE 概念。
---

# AGY 智能路由台（Antigravity 2.0 App 专属）

本 Skill 服务于 **Google Antigravity 2.0 桌面端 App**，提供两项核心能力：

1. **打开与查看可视化路由控制台**：通过官方 Sidecar 辅助面板（`sidecar://agy-router/panel/`）可视化调节自动路由总开关、预设档位与各滑块阈值，所有规则自动编译到插件目录的 `rules/AGENTS.md`（不污染任何业务仓库）。
2. **极简指令选型参谋与分类速查**：零反问直接交付带 `@` 上下文挂载的可复制命令块与近邻排他理由，严格聚焦 Antigravity 2.0 App 支持的 19 项内置斜杠指令。

## 关键不变量

1. **只适配 Antigravity 2.0 桌面端 App**：严禁推荐任何终端 `agy` CLI 专属指令（如 `/undo`、`/rewind`、`/branch`、`/fork`、`/clear`、`/new`、`/resume`、`/switch`、`/effort`、`/codesearch`、`/diff`、`/statusline`、`/title`、`/voice`、`/exit`），也不要引入 IDE 专属概念（如编辑器内联 CodeLens）。
2. **选型模式零反问**：用户求推荐指令时，信息充足直接给 1 个最优可复制命令；缺前提时并列给 A/B 两条条件分支命令，禁止停下来反问，也不主动出题考核。
3. **只读查看配置**：如需在聊天中回答当前路由阈值，只读读取 `~/.gemini/config/plugins/agy-router/data/settings.json`，绝不手动篡改插件配置文件或绕过 Sidecar 面板手改内部状态。

## 工作流程

### 模式 A：打开或查看路由控制台

当用户说“打开路由台”“调一下自动 Plan 阈值”“开关自动路由”“查看当前路由配置”时：

1. 直接在回复中提供可点击的 Sidecar 面板打开链接与插件管理链接（仅输出真实存在的链接）：
   - 打开右侧面板：`[AGY 智能路由台](sidecar://agy-router/panel/)`
   - 插件总开关管理：`[AGY 智能路由台](customization://agy-router)`
2. 如果用户顺带询问当前阈值或开关状态，可只读查看 `~/.gemini/config/plugins/agy-router/data/settings.json` 并简要列出当前档位、总开关状态与关键阈值（如 `plan.minFiles`、`grillMe.maxQuestions` 等），提示在右侧面板滑块调整后会在下一回合自动生效。

### 模式 B：极简指令选型参谋

当用户问“这活该敲什么指令”“用哪个模式好”时，对照下表静默锁定指令，按 **「首选指令（含套餐提示）→ 带 `@` 挂载的可复制代码块 → 1 句触发效果 → 1 句近邻排他理由（高阶套餐附普通号平替）」** 在 150 字内交付（跨阶段任务给先后两步连招）：

- **动手前对齐**：需求模糊未定界用 `/grill-me`；目标明确但跨多文件或改架构先出方案用 `/plan`。
- **自治与多智能体**：单线死磕修通测试用 `/goal`；疑难故障多假设深挖用 `/boost`（付费计划）；异构分工加验收用 `/swarm`（Pro / Ultra）；同质对象批处理并发脚本用 `/run-workflow`（Pro / Ultra）；跨天大迁移用 `/teamwork`（付费计划）。
- **旁支工具与可视化**：不污染主线的旁支快问用 `/btw`；长对话浓缩减负用 `/compact`；动态网页点击与截图验 UI 用 `/browser`；内嵌或独立交互式图表/流程演示用 `/generative_ui`（App 专属）。
- **定时与自动化**：当前会话临时倒计时或轻量 Cron 用 `/schedule`；后台常驻定时任务（左侧 Automations 面板管理）用 `/automation`（App 专属）。
- **规则、插件与迁移**：人工纠偏沉淀规则用 `/learn`；插件安装与启停管理用 `/plugin`；编写 Rules/Skills/Hooks/MCP 规范用 `/agy-customizations`；迁移 Claude Code/Cursor 等配置用 `/migrate-agent-settings`；升级旧版 Workflow 用 `/migrate-workflows`；查官方文档用 `/antigravity-guide`。

### 模式 C：完整分类速查或深度辨析

当用户要求“列出所有 App 指令”“对比 X 和 Y 有什么区别”或询问桌面端怎么撤回/分叉会话时：

1. 先读取 [references/app-commands-matrix.md](references/app-commands-matrix.md)。
2. 按桌面端 5 大功能组输出结构化对照表或桌面端 UI 操作指路（如历史消息回退、Review Changes 拒绝单文件更改、新开对话并用 `@历史会话` 继承上下文等）。
