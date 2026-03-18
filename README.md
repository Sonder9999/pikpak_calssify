# PikPak Classify Web

[中文说明](./README.zh-CN.md)

PikPak Classify Web is a Bun + ElysiaJS web application for scanning PikPak files, generating folder suggestions with an LLM, reviewing classification results, and executing batch moves from a Chinese dashboard.

## Features

- Bun + ElysiaJS backend with a browser dashboard
- Chinese-only UI with bilingual repository documentation
- Environment-based configuration via `.env`
- TypeScript-native workflow for scan, folder suggestion, classification, and move
- Real-time job log streaming via SSE
- Dry-run preview before destructive move operations

## Project Structure

- `src/` - server, services, configuration, and workflow logic
- `public/` - static dashboard assets
- `tests/` - Bun test suite
- `openspec/` - planning artifacts for the current change

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Fill in your PikPak and LLM credentials in `.env`.

## Run

```bash
bun run dev
```

Open `http://localhost:3000`.

## Commands

- `bun run dev` - start the app in watch mode
- `bun run start` - start the app once
- `bun run test` - run the Bun test suite
- `bun run fmt` - format source and test files
- `bun run check` - run the verification suite

## Workflow

1. Scan files from the configured PikPak source folder
2. Generate folder suggestions with the configured LLM
3. Classify files into the suggested folders
4. Review the move plan in the dashboard
5. Run dry-run or confirm the real move

## Git Hygiene

The repository baseline intentionally excludes Python scripts, caches, logs, and generated output files. Only required code, config templates, docs, and project metadata should be tracked.
