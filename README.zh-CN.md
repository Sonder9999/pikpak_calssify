# PikPak 分类网页工具

[English README](./README.md)

这是一个基于 `Bun + ElysiaJS` 的 PikPak 分类网页应用，用于扫描 PikPak 文件、调用 LLM 生成目录建议、执行分类、预览移动计划，并在中文控制台中完成批量移动。

## 功能特性

- 基于 Bun + ElysiaJS 的中文网页控制台
- 支持通过 `.env` 管理运行配置，并可在网页中直接修改
- LLM 与 PikPak 请求均支持代理转发
- 基于 SSE 的实时日志流，并带有心跳保活
- 支持扫描、目录建议、分类、预演移动和正式移动完整流程
- 支持手动同步 `PIKPAK_TARGET_FOLDER` 下已有的分类目录
- 支持在网页中编辑 Prompt 和分类目录库
- 支持停止当前长时间运行的任务
- `tests/` 目录已纳入版本控制，便于持续回归验证

## 目录结构

- `src/`：服务端、配置、服务层和工作流逻辑
- `public/`：网页界面资源，包括 HTML、CSS、浏览器脚本
- `tests/`：基于 Bun 的测试用例
- `data/`：运行时生成的 Prompt 和分类目录数据
- `output/`：扫描结果、分类结果、移动计划等产物

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

然后打开 `http://localhost:3000`。

## 使用流程

1. 扫描配置好的 PikPak 源目录
2. 调用 LLM 生成目录建议
3. 对扫描结果执行分类
4. 在网页中查看分类结果和移动预览
5. 先执行预演，再确认正式移动
6. 如任务耗时较长，可点击“停止当前任务”中断执行

## 网页界面亮点

- 显示当前代理状态和代理地址
- 实时展示任务日志，并通过心跳防止日志流中断
- 显示目录建议和分类任务的批次进度
- 支持网页修改运行配置、Prompt 和分类目录
- 支持手动同步目标目录下已有分类文件夹
- 支持停止当前运行中的任务

## 常用命令

- `bun run dev`：开发模式启动
- `bun run start`：普通启动
- `bun run test`：运行全部测试
- `bun run fmt`：格式化源代码和测试文件
- `bun run check`：运行校验命令

## 测试说明

当前 `tests/` 中已经覆盖以下关键行为：

- 配置解析与脱敏摘要
- 代理配置向 LLM 请求透传
- 任务状态流转，包括取消任务
- 设置持久化
- 移动计划分组逻辑
