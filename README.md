# PikPak Classify Web

[中文说明](./README.zh-CN.md)

PikPak Classify Web is a `Bun + ElysiaJS` application for scanning PikPak files, generating folder suggestions with an LLM, classifying files, previewing move plans, and executing batch moves from a Chinese dashboard.

## Features

- Chinese web dashboard with Bun + ElysiaJS backend
- `.env`-based runtime configuration with editable settings in the UI
- Proxy-aware outbound requests for both LLM and PikPak APIs
- Real-time job logs via SSE with heartbeat protection
- Folder suggestion, classification, dry-run, and real move workflow
- Manual sync for existing target folders in `PIKPAK_TARGET_FOLDER`
- Prompt editing and category library editing from the browser
- Stop-current-job control for long-running classify or move tasks
- Bun test suite tracked in `tests/`

## Project Structure

- `src/` - server, config, services, workflow logic
- `public/` - dashboard HTML, CSS, and browser script
- `tests/` - Bun-based regression and behavior tests
- `data/` - local prompt and category data files generated at runtime
- `output/` - generated scan, classification, and move artifacts

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

## Workflow

1. Scan files from the configured PikPak source folder
2. Generate folder suggestions with the configured LLM
3. Run classification for the scanned file set
4. Review the move plan and category distribution
5. Run dry-run or confirm the real move
6. Stop the current job if you need to interrupt a long task

## Web UI Highlights

- Shows current proxy status and proxy URL
- Streams live job logs and keeps SSE alive with heartbeat events
- Displays batch progress for folder suggestion and classification
- Lets you edit runtime config, prompts, and category folders
- Supports manual sync of existing target subfolders
- Provides a `Stop Current Job` button for running tasks

## Commands

- `bun run dev` - start in watch mode
- `bun run start` - start once
- `bun run test` - run all tests
- `bun run fmt` - format source and test files
- `bun run check` - run the verification suite

## Testing

The repository now tracks the `tests/` directory. Current tests cover:

- config parsing and masked summaries
- proxy propagation into LLM requests
- job lifecycle events, including cancel flow
- settings persistence
- move-plan grouping logic
