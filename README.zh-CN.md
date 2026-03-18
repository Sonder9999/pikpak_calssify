# PikPak 分类网页工具

[English README](./README.md)

这是一个基于 `Bun + ElysiaJS` 的 PikPak 分类网页应用，用于扫描 PikPak 文件、调用 LLM 生成分类目录、预览分类结果，并在中文控制台中执行批量移动。

## 功能特性

- 基于 Bun + ElysiaJS 的后端与网页控制台
- UI 仅提供中文，仓库文档提供中英文 README
- 使用 `.env` 管理运行配置
- 用 TypeScript 实现扫描、目录建议、分类和移动流程
- 通过 SSE 提供实时日志流
- 支持 Dry Run 预演，正式移动前需要确认

## 目录结构

- `src/`：服务端、配置、工作流和业务逻辑
- `public/`：网页静态资源
- `tests/`：Bun 测试
- `openspec/`：本次变更的规划文档

## 安装

1. 安装依赖：

   ```bash
   bun install
   ```

2. 复制环境变量模板：

   ```bash
   cp .env.example .env
   ```

3. 在 `.env` 中填写 PikPak 和 LLM 的真实配置。

## 启动

```bash
bun run dev
```

然后打开 `http://localhost:3000`。

## 常用命令

- `bun run dev`：开发模式启动
- `bun run start`：普通启动
- `bun run test`：运行测试
- `bun run fmt`：格式化源码与测试文件
- `bun run check`：运行校验命令

## 使用流程

1. 扫描配置好的 PikPak 源目录
2. 调用 LLM 生成分类目录建议
3. 执行分类
4. 在页面中查看移动预览
5. 先执行 Dry Run，确认后再正式移动

## Git 提交说明

新的 Git 基线不会纳入旧 Python 脚本、缓存、日志和运行产物，只提交必要的源码、配置模板、文档和项目元数据。
