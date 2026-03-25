# PikPak 分类网页工具

[English README](./README.md)

这是一个基于 `Bun + ElysiaJS` 的 PikPak 分类网页应用，用于扫描 PikPak 文件、调用 LLM 生成目录建议、执行分类、预览移动计划，并通过现代化单页流程工作台完成批量移动。

## 功能特性

- 单页步骤流工作台，按 `扫描 → 目录建议 → 执行分类 → 预演移动 → 正式移动` 顺序完整展开
- 基于 React + Vite + Tailwind CSS 的现代化 UI，支持磨砂玻璃质感
- 支持深浅主题切换，并记住当前浏览器中的主题偏好
- 使用 `.env` 管理运行配置，同时支持在网页中直接编辑
- LLM 与 PikPak 请求都支持代理转发
- 基于 SSE 的实时任务日志与状态更新
- 支持在浏览器中编辑 Prompt 与分类目录
- 支持停止当前长时间运行中的任务
- `tests/` 目录纳入版本控制，便于持续回归验证

## 目录结构

- `src/`：Elysia 服务端、配置、服务层与工作流逻辑
- `ui/`：React + Vite + Tailwind 前端源码
- `public/`：生产环境前端构建产物，不纳入 git 追踪
- `tests/`：基于 Bun 的回归与行为测试
- `data/`：运行时生成的 Prompt 与分类目录数据
- `output/`：扫描结果、分类结果、移动计划等产物
- `openspec/`：需求变更、规格说明与实现任务

## 安装

1. 安装依赖：

   ```bash
   bun install
   ```

2. 复制环境变量模板：

   ```bash
   cp .env.example .env
   ```

3. 按需填写 `.env` 中的账号、路径和模型配置。

## 关键环境变量

- `PIKPAK_USERNAME`：PikPak 账号
- `PIKPAK_PASSWORD`：PikPak 密码
- `PIKPAK_SOURCE_FOLDER`：待扫描的源目录
- `PIKPAK_TARGET_FOLDER`：分类后的目标根目录
- `PIKPAK_DEVICE_ID`：可选，留空时自动生成
- `LLM_API_KEY`：模型服务 API Key
- `LLM_BASE_URL`：模型服务地址
- `LLM_MODEL`：模型名称
- `PROXY_URL`：可选代理地址，例如 `http://127.0.0.1:7890`
- `BATCH_SIZE`：LLM 每批处理的文件数量
- `MOVE_BATCH_SIZE`：每批移动的文件数量

## 启动

```bash
bun run dev
```

这条命令会同时启动 Bun API 服务和 Vite 前端开发服务器。

前端页面打开 `http://127.0.0.1:4173`。

后端 API 保持在 `http://127.0.0.1:3000`。

## 前端构建

如果你修改了新的前端源码，可以执行：

```bash
bun run build:ui
```

构建产物会输出到 `public/`，由 Elysia 服务端直接提供。
`public/` 下的这些构建文件不纳入 git 追踪。

## 使用流程

1. 扫描配置好的 PikPak 源目录
2. 调用 LLM 生成目录建议
3. 对扫描结果执行分类
4. 先进行 Dry Run，确认移动计划和分类分布
5. 确认无误后再执行正式移动
6. 如果任务耗时较长，可以随时停止当前任务

## 常用命令

- `bun run dev`：同时启动 Bun API 服务和 Vite 前端开发环境
- `bun run dev:server`：仅启动 Bun API 服务（watch 模式）
- `bun run dev:ui`：启动 Vite 前端开发服务器
- `bun run start`：普通启动
- `bun run build`：构建前端到 `public/`
- `bun run build:ui`：构建前端到 `public/`
- `bun run test`：运行全部测试
- `bun run fmt`：格式化服务端、前端和测试文件
- `bun run check`：运行校验命令

## 测试说明

当前测试已覆盖以下关键行为：

- 配置解析与脱敏摘要
- 代理配置向 LLM 请求透传
- 任务状态流转，包括取消任务
- 设置持久化
- 移动计划分组逻辑
- 仪表盘视图模型的步骤状态与主题偏好行为
