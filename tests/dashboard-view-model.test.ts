import { describe, expect, test } from "bun:test";
import {
  buildWorkflowSteps,
  resolveThemePreference,
  summarizeStepMessage,
  type ThemePreference,
} from "../ui/src/lib/dashboard-view-model";
import type {
  ClassificationArtifacts,
  FolderSuggestions,
  JobRecord,
  MovePlan,
  ScanArtifacts,
} from "../src/types";

function createJob(overrides: Partial<JobRecord>): JobRecord {
  return {
    id: "job-1",
    type: "scan",
    status: "pending",
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z",
    logs: [],
    ...overrides,
  };
}

function createScan(count = 3): ScanArtifacts {
  return {
    files: Array.from({ length: count }, (_, index) => ({
      id: `file-${index}`,
      path: `/source/file-${index}.mp4`,
      name: `file-${index}.mp4`,
      size: 100,
      mimeType: "video/mp4",
      durationSeconds: 60,
      isVideo: true,
    })),
    skipped: [],
    createdAt: "2026-03-25T00:00:00.000Z",
  };
}

function createFolders(count = 4): FolderSuggestions {
  return {
    folders: Array.from({ length: count }, (_, index) => `分类${index + 1}`),
    createdAt: "2026-03-25T00:00:00.000Z",
  };
}

function createClassification(count = 3): ClassificationArtifacts {
  return {
    folders: ["电影", "短视频", "其他"],
    items: Array.from({ length: count }, (_, index) => ({
      fileId: `file-${index}`,
      path: `/source/file-${index}.mp4`,
      name: `file-${index}.mp4`,
      folder: index % 2 === 0 ? "电影" : "短视频",
    })),
    createdAt: "2026-03-25T00:00:00.000Z",
  };
}

function createPlan(totalFiles = 3): MovePlan {
  return {
    groups: [
      {
        folder: "电影",
        files: createClassification(totalFiles).items,
      },
    ],
    totalFiles,
    createdAt: "2026-03-25T00:00:00.000Z",
  };
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

describe("buildWorkflowSteps", () => {
  test("truncates oversized running messages for compact step summaries", () => {
    const longMessage =
      "目录建议完成：" +
      Array.from({ length: 40 }, (_, index) => `超长目录名称${index + 1}`).join("，");

    expect(summarizeStepMessage(longMessage).length).toBeLessThanOrEqual(121);
    expect(summarizeStepMessage(longMessage)).toEndWith("...");
  });

  test("shows only scan as actionable on first load", () => {
    const steps = buildWorkflowSteps({});

    expect(steps).toHaveLength(5);
    expect(steps[0].status).toBe("actionable");
    expect(steps[1].status).toBe("locked");
    expect(steps[0].summary).toContain("开始扫描");
  });

  test("marks the active classify step as running while keeping previous results complete", () => {
    const longClassifyLog =
      "开始分类：" +
      Array.from({ length: 30 }, (_, index) => `超长任务日志片段${index + 1}`).join("-");

    const steps = buildWorkflowSteps({
      scan: createScan(12),
      folderSuggestions: createFolders(6),
      currentJob: createJob({
        type: "classify",
        status: "running",
        logs: [longClassifyLog],
      }),
    });

    expect(steps[0].status).toBe("completed");
    expect(steps[1].status).toBe("completed");
    expect(steps[2].status).toBe("running");
    expect(steps[2].summary).toContain("开始分类");
    expect(steps[2].summary.length).toBeLessThanOrEqual(121);
    expect(steps[3].status).toBe("locked");
  });

  test("marks later steps complete when artifacts are present", () => {
    const steps = buildWorkflowSteps({
      scan: createScan(5),
      folderSuggestions: createFolders(3),
      classification: createClassification(5),
      movePlan: createPlan(5),
      currentJob: createJob({
        type: "move",
        status: "completed",
        logs: ["已移动 5/5"],
      }),
    });

    expect(steps[2].status).toBe("completed");
    expect(steps[3].status).toBe("completed");
    expect(steps[4].status).toBe("completed");
    expect(steps[4].summary).toContain("5 个文件");
  });
});
