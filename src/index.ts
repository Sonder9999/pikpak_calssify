import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import {
  ensureOutputDir,
  getMaskedConfigSummary,
  loadConfig,
  validateConfig,
  validateLlmConfig,
} from "./config";
import { JobManager } from "./services/job-manager";
import { WorkflowService } from "./services/workflow-service";
import { jsonResponse } from "./utils";

const config = loadConfig();
await ensureOutputDir(config);

const jobs = new JobManager();
const workflow = new WorkflowService(config, jobs);

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
        {
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      ),
  )
  .get("/api/health", () => ({
    ok: true,
    config: validateConfig(config),
    llm: validateLlmConfig(config),
  }))
  .get("/api/config", () => ({
    config: getMaskedConfigSummary(config),
    validation: validateConfig(config),
    llmValidation: validateLlmConfig(config),
  }))
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
        const send = (data: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        };

        send({ type: "snapshot", payload: jobs.snapshot(params.id) });
        const unsubscribe = jobs.subscribe(params.id, (event) => send(event));

        request.signal.addEventListener("abort", () => {
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

app.listen(config.port);

console.log(`PikPak Classify Web 已启动：http://localhost:${config.port}`);
