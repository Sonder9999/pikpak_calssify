import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import {
  ensureOutputDir,
  loadConfig,
  validateConfig,
  validateLlmConfig,
} from "./config";
import { jsonResponse } from "./utils";
import { JobManager } from "./services/job-manager";
import { SettingsService } from "./services/settings-service";
import { WorkflowService } from "./services/workflow-service";
import type { PromptSettings, RuntimeSettingsPayload } from "./types";

const startupConfig = loadConfig();
await ensureOutputDir(startupConfig);

const jobs = new JobManager();
const settings = new SettingsService();
await settings.ensureDataFiles();
const workflow = new WorkflowService(settings, jobs);

function createJobRunner(
  type: string,
  run: (jobId: string) => Promise<unknown>,
) {
  const job = jobs.createJob(type);
  queueMicrotask(async () => {
    try {
      await run(job.id);
    } catch (error) {
      jobs.fail(job.id, error instanceof Error ? error.message : String(error));
    }
  });
  return job;
}

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({ assets: join(process.cwd(), "public"), prefix: "/" }))
  .get(
    "/",
    async () =>
      new Response(
        await readFile(join(process.cwd(), "public/index.html"), "utf8"),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      ),
  )
  .get("/api/health", async () => {
    const config = await settings.loadRuntimeConfig();
    return {
      ok: true,
      config: validateConfig(config),
      llm: validateLlmConfig(config),
    };
  })
  .get("/api/config", async () => settings.getMaskedRuntimeConfig())
  .get("/api/settings/runtime", async () => settings.getEditableRuntimeConfig())
  .put("/api/settings/runtime", async ({ body }) => {
    const payload = body as RuntimeSettingsPayload & { port?: number };
    const config = await settings.saveRuntimeConfig(payload);
    await ensureOutputDir(config);
    return jsonResponse({
      saved: true,
      config,
      validation: validateConfig(config),
      llmValidation: validateLlmConfig(config),
    });
  })
  .get("/api/settings/prompts", async () =>
    jsonResponse(await settings.getPrompts()),
  )
  .put("/api/settings/prompts", async ({ body }) => {
    const payload = body as Pick<
      PromptSettings,
      "folderSuggestion" | "classification"
    >;
    return jsonResponse(await settings.savePrompts(payload));
  })
  .post("/api/settings/prompts/reset", async () =>
    jsonResponse(await settings.resetPrompts()),
  )
  .get("/api/settings/categories", async () =>
    jsonResponse(await settings.getCategoryFolders()),
  )
  .put("/api/settings/categories", async ({ body }) => {
    const payload = body as { folders: string[] };
    return jsonResponse(await settings.saveCategoryFolders(payload.folders));
  })
  .post("/api/settings/categories/sync", async () =>
    jsonResponse(await workflow.syncExistingTargetFolders()),
  )
  .get("/api/workflow/plan", async () =>
    jsonResponse(
      (await workflow.getLatestMovePlan()) ?? { groups: [], totalFiles: 0 },
    ),
  )
  .get("/api/workflow/scan", async () =>
    jsonResponse(
      (await workflow.getLatestScan()) ?? { files: [], skipped: [] },
    ),
  )
  .get("/api/workflow/classification", async () =>
    jsonResponse((await workflow.getLatestClassification()) ?? { items: [] }),
  )
  .post("/api/workflow/scan", () =>
    jsonResponse(
      { jobId: createJobRunner("scan", (jobId) => workflow.scan(jobId)).id },
      202,
    ),
  )
  .post("/api/workflow/folders", () =>
    jsonResponse(
      {
        jobId: createJobRunner("folders", (jobId) =>
          workflow.suggestFolders(jobId),
        ).id,
      },
      202,
    ),
  )
  .post("/api/workflow/classify", () =>
    jsonResponse(
      {
        jobId: createJobRunner("classify", (jobId) => workflow.classify(jobId))
          .id,
      },
      202,
    ),
  )
  .post("/api/workflow/move", async ({ body }) => {
    const payload = (body ?? {}) as { dryRun?: boolean };
    const job = createJobRunner("move", (jobId) =>
      workflow.move(jobId, payload.dryRun !== false),
    );
    return jsonResponse(
      { jobId: job.id, dryRun: payload.dryRun !== false },
      202,
    );
  })
  .get("/api/jobs/:id", ({ params }) => jsonResponse(jobs.snapshot(params.id)))
  .get("/api/jobs/:id/stream", ({ params, request }) => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (data: unknown) =>
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        send({ type: "snapshot", payload: jobs.snapshot(params.id) });
        const unsubscribe = jobs.subscribe(params.id, (event) => send(event));
        const heartbeat = setInterval(() => {
          send({ type: "heartbeat", payload: { at: new Date().toISOString() } });
        }, 10000);
        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          unsubscribe();
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  });

app.listen(startupConfig.port);
console.log(
  `PikPak Classify Web 已启动：http://localhost:${startupConfig.port}`,
);
