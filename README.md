# PikPak Classify Web

[中文说明](./README.zh-CN.md)

PikPak Classify Web is a `Bun + ElysiaJS` application for scanning PikPak files, generating folder suggestions with an LLM, classifying files, previewing move plans, and executing batch moves from a modern browser dashboard.

## Features

- Single-page step-flow dashboard for `Scan → Folder Suggestions → Classify → Dry Run → Move`
- Modern React + Vite + Tailwind UI with glass-style surfaces
- Light and dark theme toggle with local preference persistence
- `.env`-based runtime configuration with in-browser editing
- Proxy-aware outbound requests for both LLM and PikPak APIs
- Real-time job logs via SSE with heartbeat protection
- Prompt editing and category library editing from the browser
- Stop-current-job control for long-running classify or move tasks
- Bun test suite tracked in `tests/`

## Project Structure

- `src/` - Elysia server, config, services, workflow logic
- `ui/` - React + Vite + Tailwind source for the dashboard
- `public/` - generated frontend build output served by Elysia
- `tests/` - Bun-based regression and behavior tests
- `data/` - local prompt and category data files generated at runtime
- `output/` - generated scan, classification, and move artifacts
- `openspec/` - change proposals, specs, and implementation tasks

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Fill in your credentials and paths in `.env`.

## Important Environment Variables

- `PIKPAK_USERNAME` - PikPak account
- `PIKPAK_PASSWORD` - PikPak password
- `PIKPAK_SOURCE_FOLDER` - source folder to scan
- `PIKPAK_TARGET_FOLDER` - target root folder for categorized output
- `PIKPAK_DEVICE_ID` - optional device ID, leave blank to auto-generate
- `LLM_API_KEY` - model provider API key
- `LLM_BASE_URL` - model API base URL
- `LLM_MODEL` - model name
- `PROXY_URL` - optional proxy such as `http://127.0.0.1:7890`
- `BATCH_SIZE` - files per LLM batch
- `MOVE_BATCH_SIZE` - files per move batch

## Run

```bash
bun run dev
```

Then open `http://localhost:3000`.

## Frontend Workflow

For the new frontend source and generated assets:

```bash
bun run build:ui
```

The generated dashboard is written into `public/` and is served by the Elysia app.

## Workflow

1. Scan files from the configured PikPak source folder
2. Generate folder suggestions with the configured LLM
3. Run classification for the scanned file set
4. Review the move plan and category distribution with Dry Run
5. Confirm the real move when the preview looks correct
6. Stop the current job if you need to interrupt a long task

## Commands

- `bun run dev` - start the server in watch mode
- `bun run dev:ui` - run the Vite frontend dev server
- `bun run start` - start the server once
- `bun run build` - build the frontend into `public/`
- `bun run build:ui` - build the frontend into `public/`
- `bun run test` - run all tests
- `bun run fmt` - format source, frontend, and test files
- `bun run check` - run the verification suite

## Testing

Current tests cover:

- config parsing and masked summaries
- proxy propagation into LLM requests
- job lifecycle events, including cancel flow
- settings persistence
- move-plan grouping logic
- dashboard view-model behavior for step states and theme preference
