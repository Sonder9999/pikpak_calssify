import { describe, expect, test } from "bun:test";
import {
  buildConsolePages,
  buildStructuredLogFeed,
  getLatestStepJob,
  resolveThemePreference,
} from "../ui/src/lib/dashboard-view-model";
import { resolveConsoleLocale } from "../ui/src/lib/console-i18n";
import type {
  JobRecord,
  WorkflowSummaryResponse,
  WorkflowStepSummary,
} from "../src/types";

function createStepSummary(
  id: WorkflowStepSummary["id"],
  overrides: Partial<WorkflowStepSummary> = {},
): WorkflowStepSummary {
  return {
    id,
    hasArtifact: false,
    stale: false,
    canRun: id === "scan",
    ...overrides,
  };
}

function createJob(overrides: Partial<JobRecord>): JobRecord {
  return {
    id: "job-1",
    type: "scan",
    status: "pending",
    createdAt: "2026-03-26T00:00:00.000Z",
    updatedAt: "2026-03-26T00:00:00.000Z",
    logs: [],
    logEntries: [],
    ...overrides,
  };
}

function createSummary(overrides: Partial<WorkflowSummaryResponse> = {}) {
  return {
    steps: {
      scan: createStepSummary("scan"),
      folders: createStepSummary("folders"),
      classify: createStepSummary("classify"),
      "dry-run": createStepSummary("dry-run"),
      move: createStepSummary("move"),
    },
    jobs: [],
    ...overrides,
  } satisfies WorkflowSummaryResponse;
}

describe("resolveThemePreference", () => {
  test("prefers stored theme when valid", () => {
    expect(resolveThemePreference("light", true)).toBe("light");
    expect(resolveThemePreference("dark", false)).toBe("dark");
  });

  test("falls back to system preference for invalid storage", () => {
    expect(resolveThemePreference("unexpected", true)).toBe("dark");
    expect(resolveThemePreference(null, false)).toBe("light");
  });
});

describe("resolveConsoleLocale", () => {
  test("defaults to simplified Chinese when storage is empty or invalid", () => {
    expect(resolveConsoleLocale(null)).toBe("zh-CN");
    expect(resolveConsoleLocale("unknown")).toBe("zh-CN");
  });

  test("keeps supported locales from storage", () => {
    expect(resolveConsoleLocale("zh-CN")).toBe("zh-CN");
    expect(resolveConsoleLocale("en-US")).toBe("en-US");
  });
});

describe("console page model", () => {
  test("maps backend summary into five step pages plus logs in Chinese by default", () => {
    const pages = buildConsolePages(
      createSummary({
        steps: {
          scan: createStepSummary("scan", { canRun: true }),
          folders: createStepSummary("folders", {
            hasArtifact: true,
            canRun: true,
          }),
          classify: createStepSummary("classify", {
            hasArtifact: true,
            stale: true,
            staleReason:
              "classification inputs changed after the artifact was generated",
            canRun: true,
          }),
          "dry-run": createStepSummary("dry-run", {
            hasArtifact: true,
            canRun: true,
          }),
          move: createStepSummary("move", { canRun: true }),
        },
        jobs: [
          createJob({
            id: "job-logs",
            type: "classify",
            status: "failed",
            logEntries: [
              {
                level: "error",
                step: "classify",
                message: "classification failed",
                timestamp: "2026-03-26T00:30:00.000Z",
              },
            ],
          }),
        ],
      }),
      "zh-CN",
    );

    expect(pages).toHaveLength(6);
    expect(pages.map((page) => page.id)).toEqual([
      "scan",
      "folders",
      "classify",
      "dry-run",
      "move",
      "logs",
    ]);
    expect(pages[2]).toMatchObject({
      id: "classify",
      stale: true,
      statusLabel: "需更新",
    });
    expect(pages[5]).toMatchObject({
      id: "logs",
      title: "日志",
      countLabel: "1 条事件",
    });
  });

  test("can render page labels in English when locale toggles", () => {
    const pages = buildConsolePages(createSummary(), "en-US");

    expect(pages[0]).toMatchObject({
      id: "scan",
      title: "Scan",
      statusLabel: "Available",
    });
    expect(pages[5]?.title).toBe("Logs");
  });

  test("returns the latest job for a specific step", () => {
    const latestDryRun = createJob({
      id: "job-dry-run",
      type: "dry-run",
      createdAt: "2026-03-26T00:10:00.000Z",
    });
    const olderDryRun = createJob({
      id: "job-dry-run-older",
      type: "dry-run",
      createdAt: "2026-03-26T00:05:00.000Z",
    });

    const job = getLatestStepJob("dry-run", [
      olderDryRun,
      createJob({ id: "job-scan", type: "scan" }),
      latestDryRun,
    ]);

    expect(job?.id).toBe("job-dry-run");
  });

  test("flattens and sorts structured logs newest first", () => {
    const entries = buildStructuredLogFeed([
      createJob({
        id: "job-1",
        type: "scan",
        status: "completed",
        logEntries: [
          {
            level: "info",
            step: "scan",
            message: "scan done",
            timestamp: "2026-03-26T00:01:00.000Z",
          },
        ],
      }),
      createJob({
        id: "job-2",
        type: "classify",
        status: "failed",
        logEntries: [
          {
            level: "error",
            step: "classify",
            message: "classification failed",
            timestamp: "2026-03-26T00:02:00.000Z",
          },
        ],
      }),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      jobId: "job-2",
      level: "error",
      message: "classification failed",
    });
    expect(entries[1]?.jobId).toBe("job-1");
  });
});
