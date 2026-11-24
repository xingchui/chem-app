# 化学方程式练习

一个面向中学生的化学方程式书写练习应用。内置 344 道按教材章节组织的题目，支持实时 LaTeX 预览、智能判卷（正误判定与反馈）、章节/随机/自定义三种练习模式与成绩统计。

## 功能特性

- **344 道题目**，覆盖九年级上/下册、必修第一/二册、选择性必修 1~3（化学反应原理、物质结构与性质、有机化学基础）
- **实时预览**：输入化学方程式即时渲染为 LaTeX 排版，语法错误实时提示
- **智能判卷**：支持系数归一化、离子方程式、状态符号（↑↓）、反应条件（加热/高温/催化剂等）的语义判定，`=` 与 `→` 等价，可逆反应 `⇌` 严格匹配
- **三种模式**：按章节练习 / 随机出题 / 自定义题库练习
- **自定义题库**：文本批量导入（支持「描述 | 方程式」）、JSON 导入导出、本地持久化
- **成绩统计**：正确率、完成度本地持久化（localStorage）
- **快捷输入**：工具栏一键插入上下标、电荷、状态符号（Ctrl+1~0 快捷键）
- **跨平台打包**：Web 应用 + Electron 便携版（Windows）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript |
| 构建 | Vite 8（Rolldown） |
| 公式渲染 | KaTeX |
| 引擎 | 自研解析器（`src/engine/parse.ts`）+ 判定器（`src/engine/judge.ts`） |
| 测试 | Vitest + Testing Library + Oxlint |
| 桌面打包 | Electron + electron-builder（portable 免安装版） |

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（http://localhost:5173）
npm test           # 运行全部测试
npm run lint       # 代码检查
npm run typecheck  # 类型检查
npm run build      # 生产构建（输出到 dist/）
```

## 下载 Windows 可执行文件

直接下载便携版（免安装，双击即用）：

- 最新版：[chem-app-1.2.0.exe](https://github.com/xingchui/chem-app/releases/latest/download/chem-app-1.2.0.exe)
- 或前往 [Releases 页面](https://github.com/xingchui/chem-app/releases) 选择版本

> 说明：GitHub Release 资产使用 ASCII 文件名（`chem-app-<版本>.exe`）以兼容各平台下载；本地打包产物仍为中文名（见下节）。

## 打包 Windows 可执行文件

```bash
npm run dist:exe
```

生成 `release/化学方程式练习 <版本>.exe`（便携单文件，免安装，双击即用）。

> 注：打包依赖 `build-resources/electron-dist/`（Electron 预解压目录）。若该目录缺失，
> 需先将对应版本的 Electron 发行包解压到此处，或移除 `package.json` 中 `build.electronDist` 配置
> 让 electron-builder 自动下载。

## 项目结构

```
src/
├── engine/          # 核心引擎（纯函数，无 UI 依赖）
│   ├── parse.ts     # 化学方程式解析器（规范式文法）
│   ├── judge.ts     # 答案判定器（等价比较、条件归一化）
│   ├── latex.ts     # 规范式 → LaTeX 渲染
│   └── *.test.ts    # 对应单元测试
├── components/      # 通用 UI 组件（Page / SelectList / ShortcutBar / Latex / ErrorBoundary）
├── views/           # 页面视图（首页、教材/章/节选择、练习、统计、完成、自定义题库）
├── questions.ts     # 题库（按教材章节组织，344 题）
├── customQuestions.ts # 自定义题库（localStorage / 文本解析 / JSON 导入导出）
├── stats.ts         # 学习统计持久化（校验损坏数据）
├── practice.ts      # 练习会话纯函数（洗牌 / 进度 / 自定义题转换）
├── shortcuts.ts     # 快捷符号与 Ctrl+数字映射
├── usePreview.ts    # 输入 → 实时 LaTeX 预览 hook
├── App.tsx          # 应用控制器（状态机 + 视图切换）
└── main.tsx         # 入口（ErrorBoundary 兜底）
electron/
└── main.cjs         # Electron 主进程（加载 dist/，外链走系统浏览器）
```

## 题目文法

题目答案使用规范式文法（见 `src/engine/parse.ts`）：

```
Fe2O3 + 3CO =[高温] 2Fe + 3CO2↑
```

- 条件写在箭头后：`[上条件][下条件]`
- 可逆反应用 `⇌`（或 `<=>`）
- 离子方程式直接书写：`Ag+ / Cl- / SO42- / Cu2+ / e^-`
- 状态符号：`↑` 气体、`↓` 沉淀、`(g)/(l)/(s)/(aq)` 相态

## 判定规则（摘要）

- `=` 与 `→` 等价；`⇌` 必须严格匹配
- 系数归一化：`2H2 + O2 = 2H2O` 与 `H2 + 1/2O2 = H2O` 判定为等价
- 条件集合无序等价：「浓硫酸+加热」≡「加热+浓硫酸」
- 有机物支持结构简式/分子式等价（`C2H5OH` ≡ `CH3CH2OH` ≡ `C2H6O`），排斥同分异构体

## 更新日志

### v1.2.0（2026-11-24）

- 题库由 272 题扩容至 344 题：补齐九年级上/下册全部单元、必修第一册第四章、选择性必修2 第一/二章、选择性必修3 第一章
- 章节/课题按教材序号排序，新增题目不再受插入顺序影响
- 新增题库覆盖度与章节排序测试
- 架构重构：拆分 `views/`、`components/`，抽出 `stats.ts` / `practice.ts` / `shortcuts.ts` / `usePreview.ts`，`App.tsx` 只保留状态机与视图切换
- 修复判题后快捷栏仍可改写答案、自定义题 ID 冲突、统计损坏数据、导出下载过早释放 URL 等问题
- 增加渲染错误兜底（ErrorBoundary）、无障碍标签与页面元信息
- 新增统计、练习工具、ID 唯一性及界面冒烟测试

### v1.1.0（2026-08-21）

- 新增自定义题库：文本批量导入（支持「描述 | 方程式」）、JSON 导入导出、本地持久化
- 修复自定义题库粘贴、有机反应箭头显示等问题

### v1.0.0（2026-08-16）

- 初始发布：272 题题库、实时预览、智能判卷、成绩统计
- 方程式箭头统一显示为等号（`=` 与 `→` 等价解析，可逆反应 `⇌` 保留）
- 自定义应用图标，Electron portable 打包

## 许可

本项目仅供学习交流使用。