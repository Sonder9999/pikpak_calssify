import { describe, expect, test } from "bun:test";
import type {
  ClassificationArtifacts,
  FolderSuggestions,
  MovePlan,
  ScanArtifacts,
  WorkflowStepCurrentSignatures,
} from "../src/types";
import {
  buildMovePlan,
  buildWorkflowStepSummaries,
} from "../src/services/workflow-service";

function createSignatures(
  overrides: Partial<WorkflowStepCurrentSignatures> = {},
): WorkflowStepCurrentSignatures {
  return {
    scan: "scan-v1",
    folders: "folders-v1",
    classify: "classify-v1",
    move: "move-v1",
    ...overrides,
  };
}

function createScan(overrides: Partial<ScanArtifacts> = {}): ScanArtifacts {
  return {
    files: [
      {
        id: "file-1",
        path: "/source/file-1.mp4",
        name: "file-1.mp4",
        size: 100,
        mimeType: "video/mp4",
        durationSeconds: 90,
        isVideo: true,
      },
    ],
    skipped: [],
    createdAt: "2026-03-26T00:00:00.000Z",
    meta: {
      signature: "scan-v1",
    },
    ...overrides,
  };
}

function createFolders(
  overrides: Partial<FolderSuggestions> = {},
): FolderSuggestions {
  return {
    folders: ["Movies", "Other"],
    createdAt: "2026-03-26T00:05:00.000Z",
    meta: {
      signature: "folders-v1",
      sourceScanCreatedAt: "2026-03-26T00:00:00.000Z",
    },
    ...overrides,
  };
}

function createClassification(
  overrides: Partial<ClassificationArtifacts> = {},
): ClassificationArtifacts {
  return {
    folders: ["Movies", "Other"],
    items: [
      {
        fileId: "file-1",
        path: "/source/file-1.mp4",
        name: "file-1.mp4",
        folder: "Movies",
      },
    ],
    createdAt: "2026-03-26T00:10:00.000Z",
    meta: {
      signature: "classify-v1",
      sourceScanCreatedAt: "2026-03-26T00:00:00.000Z",
      sourceFoldersCreatedAt: "2026-03-26T00:05:00.000Z",
    },
    ...overrides,
  };
}

function createPlan(overrides: Partial<MovePlan> = {}): MovePlan {
  return {
    groups: [
      {
        folder: "Movies",
        files: createClassification().items,
      },
    ],
    totalFiles: 1,
    createdAt: "2026-03-26T00:15:00.000Z",
    meta: {
      signature: "move-v1",
      sourceClassificationCreatedAt: "2026-03-26T00:10:00.000Z",
    },
    ...overrides,
  };
}

describe("workflow service", () => {
  test("groups classification entries into move plan", () => {
    const plan = buildMovePlan([
      { fileId: "1", path: "a.mp4", name: "a.mp4", folder: "FolderA" },
      { fileId: "2", path: "b.mp4", name: "b.mp4", folder: "Other" },
      { fileId: "3", path: "c.mp4", name: "c.mp4", folder: "FolderA" },
    ]);

    expect(plan.totalFiles).toBe(3);
    expect(plan.groups).toHaveLength(2);
    expect(
      plan.groups.find((group) => group.folder === "FolderA")?.files,
    ).toHaveLength(2);
  });

  test("marks scan actionable when no artifacts exist", () => {
    const summary = buildWorkflowStepSummaries({
      signatures: createSignatures(),
    });

    expect(summary.scan.canRun).toBe(true);
    expect(summary.scan.hasArtifact).toBe(false);
    expect(summary.folders.canRun).toBe(false);
    expect(summary.classify.canRun).toBe(false);
  });

  test("marks later steps runnable when required artifacts exist", () => {
    const summary = buildWorkflowStepSummaries({
      signatures: createSignatures(),
      scan: createScan(),
      folderSuggestions: createFolders(),
      classification: createClassification(),
      movePlan: createPlan(),
    });

    expect(summary.scan.canRun).toBe(true);
    expect(summary.folders.canRun).toBe(true);
    expect(summary.classify.canRun).toBe(true);
    expect(summary["dry-run"].canRun).toBe(true);
    expect(summary.move.canRun).toBe(true);
    expect(summary["dry-run"].hasArtifact).toBe(true);
    expect(summary.move.hasArtifact).toBe(true);
  });

  test("marks classification and move steps stale when classification inputs changed", () => {
    const summary = buildWorkflowStepSummaries({
      signatures: createSignatures({ classify: "classify-v2" }),
      scan: createScan(),
      folderSuggestions: createFolders(),
      classification: createClassification(),
      movePlan: createPlan(),
    });

    expect(summary.classify.stale).toBe(true);
    expect(summary.classify.staleReason).toContain("classification inputs");
    expect(summary["dry-run"].stale).toBe(true);
    expect(summary.move.stale).toBe(true);
  });

  test("keeps classification fresh when only move settings changed", () => {
    const summary = buildWorkflowStepSummaries({
      signatures: createSignatures({ move: "move-v2" }),
      scan: createScan(),
      folderSuggestions: createFolders(),
      classification: createClassification(),
      movePlan: createPlan(),
    });

    expect(summary.classify.stale).toBe(false);
    expect(summary["dry-run"].stale).toBe(true);
    expect(summary.move.stale).toBe(true);
    expect(summary["dry-run"].staleReason).toContain("move settings");
  });
});
