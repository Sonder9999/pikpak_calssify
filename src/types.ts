export type JobStatus =
  | "pending"
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

export interface AppConfig {
  port: number;
  network: {
    proxyUrl?: string;
  };
  pikpak: {
    username: string;
    password: string;
    sourceFolder: string;
    targetFolder: string;
    deviceId?: string;
  };
  llm: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  workflow: {
    outputDir: string;
    batchSize: number;
    onlyClassifyVideo: boolean;
    enableShortVideoFilter: boolean;
    shortVideoThresholdSeconds: number;
    moveBatchSize: number;
    moveMinDelayMs: number;
    moveMaxDelayMs: number;
  };
}

export interface ConfigValidation {
  valid: boolean;
  errors: string[];
}

export interface RuntimeSettingsPayload {
  network: AppConfig["network"];
  pikpak: AppConfig["pikpak"];
  llm: AppConfig["llm"];
  workflow: AppConfig["workflow"];
}

export interface PromptSettings {
  folderSuggestion: string;
  classification: string;
  updatedAt: string;
}

export interface CategoryFolderLibrary {
  folders: string[];
  updatedAt: string;
}

export interface FileEntry {
  id: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  durationSeconds: number;
  isVideo: boolean;
}

export interface SkippedFileEntry {
  id: string;
  path: string;
  name: string;
  mimeType: string;
  reason: string;
}

export type WorkflowStepId =
  | "scan"
  | "folders"
  | "classify"
  | "dry-run"
  | "move";

export interface ArtifactMeta {
  signature?: string;
  sourceScanCreatedAt?: string;
  sourceFoldersCreatedAt?: string;
  sourceClassificationCreatedAt?: string;
}

export interface ScanArtifacts {
  files: FileEntry[];
  skipped: SkippedFileEntry[];
  createdAt: string;
  meta?: ArtifactMeta;
}

export interface FolderSuggestions {
  folders: string[];
  createdAt: string;
  meta?: ArtifactMeta;
}

export interface ClassificationEntry {
  fileId: string;
  path: string;
  name: string;
  folder: string;
}

export interface ClassificationArtifacts {
  folders: string[];
  items: ClassificationEntry[];
  createdAt: string;
  meta?: ArtifactMeta;
}

export interface MovePlanGroup {
  folder: string;
  files: ClassificationEntry[];
}

export interface MovePlan {
  groups: MovePlanGroup[];
  totalFiles: number;
  createdAt: string;
  meta?: ArtifactMeta;
}

export interface WorkflowStepCurrentSignatures {
  scan: string;
  folders: string;
  classify: string;
  move: string;
}

export interface WorkflowStepSummary {
  id: WorkflowStepId;
  hasArtifact: boolean;
  artifactUpdatedAt?: string;
  stale: boolean;
  staleReason?: string;
  canRun: boolean;
}

export interface WorkflowSummaryResponse {
  steps: Record<WorkflowStepId, WorkflowStepSummary>;
  jobs: JobRecord[];
}

export interface JobEvent {
  type: "status" | "log" | "result";
  timestamp: string;
  payload: unknown;
}

export type JobLogLevel = "info" | "warn" | "error";

export interface JobLogEntry {
  level: JobLogLevel;
  step: string;
  message: string;
  timestamp: string;
  context?: Record<string, string | number | boolean | null>;
}

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  logs: string[];
  logEntries?: JobLogEntry[];
  result?: unknown;
  error?: string;
}

export interface PikPakFileApiItem {
  id: string;
  name: string;
  kind?: string;
  mime_type?: string;
  size?: string | number;
  parent_id?: string;
  mediatype?: string;
  video?: { duration?: number };
  media?: { duration?: number };
}
