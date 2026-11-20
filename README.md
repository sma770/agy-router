# AGY 智能路由台 (`agy-router`)

专为 **Google Antigravity 2.0 桌面端 App** 打造的原生智能路由控制台插件（Sidecar 右侧辅助面板 + 动态 `rules/AGENTS.md` + `/agy-router` 指令参谋 Skill）。

与原版终端/IDE 混合方案不同，`agy-router` **聚焦 Antigravity 2.0 桌面端 App**，彻底剥离终端 CLI 专属命令与 IDE 概念，把原本硬编码的自动路由条件（例如“改 3 个文件就强制进 Plan”）升级为**可视化可调滑块与独立开关**。

---

## 核心特性

- **原生 Aux Pane 控制台**：基于 Antigravity 官方 UI Plugin（Sidecar）机制嵌入右侧辅助面板，自动适配宿主深浅主题，零侵入软件本体，App 升级不失效。
- **零打扰起步**：首次安装默认关闭全局自动路由总开关（仅作指令速查面板使用），不干扰原有对话习惯；随时可在面板内一键开启或切换档位。
- **4 套一键预设 + 全部滑块可调**：
  - **零打扰**（默认关闭全局路由，保留底层数值）
  - **直干优先**（`Plan ≥ 8` 文件、关闭架构强制触发、`Grill-Me` 宽松最多 2 轮）
  - **均衡克制**（`Plan ≥ 6` 文件、开启架构强制触发、`Grill-Me` 宽松最多 3 轮、高耗额度的 `swarm`/`run_workflow` 默认关闭）
  - **严谨架构**（`Plan ≥ 3` 文件、开启架构强制触发、`Grill-Me` 标准最多 5 轮、全量开启并发与多智能体提示）
- **三视图纯简体中文面板**：
  1. **路由配置**：总开关、4 档预设胶囊、3 组可折叠配置卡片（规划与追问 / 多智能体与工具 / 前端指令首行提醒）、实时动态白名单提示。
  2. **指令速查**：内置 Antigravity 2.0 App 全部 **19 个斜杠指令**，支持关键词搜索、分类筛选、一键复制带 `@` 挂载的命令模板，以及 4 组易混指令对比矩阵。
  3. **规则预览**：实时展示编译出的 `rules/AGENTS.md` 原文与 24 KB 字节占用进度，改动后自动原子落盘并在下一回合生效。
- **零污染与零外部依赖**：配置与规则全部保存在插件目录自身，绝不往你的业务代码仓库写入多余文件；后端与脚本 100% 使用 Node.js 原生模块，无需 `npm install`。

---

## 安装、升级与卸载

> 前置要求：已安装 Node.js（推荐 v20+）及 Google Antigravity 2.0 桌面端 App。

### 1. 克隆并一键安装到 Antigravity App

```bash
git clone https://github.com/sma770/agy-router.git
cd agy-router
node scripts/install.mjs
```

安装脚本会自动把插件部署至 `~/.gemini/config/plugins/agy-router/`，并初始化默认“零打扰”配置与 `rules/AGENTS.md`。
**升级时再次运行 `node scripts/install.mjs` 即可，已保存的个人参数（`data/settings.json`）会自动保留并重新编译规则。**

可用可选参数指定自定义安装目录：

```bash
node scripts/install.mjs --target /path/to/plugins/agy-router
```

### 2. 在 Antigravity App 中打开面板

安装完成后，在聊天窗口发送任意以下内容即可打开控制台或调用参谋：

- `/agy-router`
- `打开 AGY 智能路由台面板`
- `这个任务该用 /plan 还是 /grill-me？`

### 3. 本地独立浏览器预览（调试 UI 用）

无需启动 Antigravity 也可在浏览器独立预览三视图控制台（仅监听 `127.0.0.1`）：

```bash
node plugin/sidecars/panel/main.mjs
# 访问 http://127.0.0.1:17920
```

### 4. 运行自动化测试

```bash
node --test tests/*.test.mjs
```

### 5. 卸载

```bash
# 彻底卸载插件
node scripts/uninstall.mjs

# 卸载前将当前配置备份到 ~/.gemini/config/agy-router.settings.backup.json
node scripts/uninstall.mjs --keep-settings
```

---

## 仓库结构

```text
agy-router/
├── README.md
├── LICENSE
├── .gitignore
├── scripts/
│   ├── install.mjs                 # 部署/升级到 ~/.gemini/config/plugins/agy-router（保留配置）
│   └── uninstall.mjs               # 干净卸载（支持 --keep-settings）
├── plugin/                         # Antigravity 原生插件载荷目录
│   ├── plugin.json                 # 插件清单（含 displayName、suggestedPrompts）
│   ├── assets/logo.svg             # 128x128 矢量图标
│   ├── rules/AGENTS.md             # 动态编译的全局路由规则（纯 Markdown，无 frontmatter）
│   ├── skills/agy-router/          # /agy-router 参谋 Skill 与 19 项 App 指令矩阵
│   └── sidecars/panel/             # Sidecar 后端、配置校验、规则编译器与三视图 Web UI
└── tests/                          # Node.js 原生自动化测试套件
```

---

## 致谢

本项目的设计灵感与部分指令分类结构源自开源项目 **[zou172866/agy-cmd](https://github.com/zou172866/agy-cmd)**，在此基础上针对 **Antigravity 2.0 桌面端 App** 进行了原生 UI Plugin 面板化改造、滑块阈值化与规则编译引擎重构。
