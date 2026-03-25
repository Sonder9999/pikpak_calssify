import type {
  CategoryFolderLibrary,
  JobLogEntry,
  JobRecord,
  PromptSettings,
  RuntimeSettingsPayload,
  WorkflowSummaryResponse,
} from "../../../src/types";
import type { ConsolePageId } from "./dashboard-view-model";

export const EMPTY_RUNTIME: RuntimeSettingsPayload = {
  network: { proxyUrl: "" },
  pikpak: {
    username: "",
    password: "",
    sourceFolder: "",
    targetFolder: "",
    deviceId: "",
  },
  llm: {
    apiKey: "",
    baseUrl: "",
    model: "",
  },
  workflow: {
    outputDir: "output",
    batchSize: 20,
    onlyClassifyVideo: false,
    enableShortVideoFilter: false,
    shortVideoThresholdSeconds: 120,
    moveBatchSize: 10,
    moveMinDelayMs: 300,
    moveMaxDelayMs: 800,
  },
};

export const EMPTY_PROMPTS: PromptSettings = {
  folderSuggestion: "",
  classification: "",
  updatedAt: "",
};

export const EMPTY_CATEGORIES: CategoryFolderLibrary = {
  folders: [],
  updatedAt: "",
};

export const EMPTY_SUMMARY: WorkflowSummaryResponse = {
  steps: {
    scan: { id: "scan", hasArtifact: false, stale: false, canRun: true },
    folders: { id: "folders", hasArtifact: false, stale: false, canRun: false },
    classify: {
      id: "classify",
      hasArtifact: false,
      stale: false,
      canRun: false,
    },
    "dry-run": {
      id: "dry-run",
      hasArtifact: false,
      stale: false,
      canRun: false,
    },
    move: { id: "move", hasArtifact: false, stale: false, canRun: false },
  },
  jobs: [],
};

export function resolvePageFromHash(hash: string): ConsolePageId {
  const page = hash.replace(/^#/, "") as ConsolePageId;
  if (
    page === "scan" ||
    page === "folders" ||
    page === "classify" ||
    page === "dry-run" ||
    page === "move" ||
    page === "logs"
  ) {
    return page;
  }
  return "scan";
}

export function setPageHash(page: ConsolePageId) {
  window.location.hash = page;
}

export function sortJobs(jobs: JobRecord[]) {
  return [...jobs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function addLogToJob(
  job: JobRecord,
  message: string,
  entry?: JobLogEntry,
): JobRecord {
  return {
    ...job,
    logs: [...job.logs, message],
    logEntries: entry ? [...(job.logEntries ?? []), entry] : job.logEntries,
    updatedAt: new Date().toISOString(),
  };
}
