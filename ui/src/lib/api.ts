import type {
  CategoryFolderLibrary,
  ClassificationArtifacts,
  ConfigValidation,
  FolderSuggestions,
  JobRecord,
  MovePlan,
  PromptSettings,
  RuntimeSettingsPayload,
  ScanArtifacts,
} from "../../../src/types";

export type WorkflowAction =
  | "scan"
  | "folders"
  | "classify"
  | "dry-run"
  | "move";

export interface HealthResponse {
  ok: boolean;
  config: ConfigValidation;
  llm: ConfigValidation;
}

export interface WorkflowConfigSummary {
  network?: {
    proxyUrl?: string;
  };
  pikpak?: {
    sourceFolder?: string;
    targetFolder?: string;
    username?: string;
  };
  llm?: {
    baseUrl?: string;
    model?: string;
  };
  workflow?: {
    outputDir?: string;
    batchSize?: number;
    moveBatchSize?: number;
  };
  validation?: ConfigValidation;
  llmValidation?: ConfigValidation;
}

async function getJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error((await response.text()) || "请求失败");
  }
  return response.json() as Promise<T>;
}

export function fetchHealth() {
  return getJson<HealthResponse>("/api/health");
}

export function fetchConfigSummary() {
  return getJson<WorkflowConfigSummary>("/api/config");
}

export function fetchRuntimeSettings() {
  return getJson<RuntimeSettingsPayload>("/api/settings/runtime");
}

export function saveRuntimeSettings(payload: RuntimeSettingsPayload) {
  return getJson<{ saved: boolean; config: RuntimeSettingsPayload }>(
    "/api/settings/runtime",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export function fetchPrompts() {
  return getJson<PromptSettings>("/api/settings/prompts");
}

export function savePrompts(
  payload: Pick<PromptSettings, "folderSuggestion" | "classification">,
) {
  return getJson<PromptSettings>("/api/settings/prompts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function resetPrompts() {
  return getJson<PromptSettings>("/api/settings/prompts/reset", {
    method: "POST",
  });
}

export function fetchCategories() {
  return getJson<CategoryFolderLibrary>("/api/settings/categories");
}

export function saveCategories(folders: string[]) {
  return getJson<CategoryFolderLibrary>("/api/settings/categories", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folders }),
  });
}

export function syncCategories() {
  return getJson<CategoryFolderLibrary>("/api/settings/categories/sync", {
    method: "POST",
  });
}

export function fetchScan() {
  return getJson<ScanArtifacts>("/api/workflow/scan");
}

export function fetchFolderSuggestions() {
  return getJson<FolderSuggestions>("/api/workflow/folders");
}

export function fetchClassification() {
  return getJson<ClassificationArtifacts>("/api/workflow/classification");
}

export function fetchMovePlan() {
  return getJson<MovePlan>("/api/workflow/plan");
}

export function runWorkflowAction(action: WorkflowAction) {
  const routeMap: Record<WorkflowAction, [string, Record<string, unknown>]> = {
    scan: ["/api/workflow/scan", {}],
    folders: ["/api/workflow/folders", {}],
    classify: ["/api/workflow/classify", {}],
    "dry-run": ["/api/workflow/move", { dryRun: true }],
    move: ["/api/workflow/move", { dryRun: false }],
  };
  const [url, payload] = routeMap[action];
  return getJson<{ jobId: string; dryRun?: boolean }>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchJob(jobId: string) {
  return getJson<JobRecord>(`/api/jobs/${jobId}`);
}

export function cancelJob(jobId: string) {
  return getJson<{ cancelled: boolean; job: JobRecord }>(
    `/api/jobs/${jobId}/cancel`,
    {
      method: "POST",
    },
  );
}
