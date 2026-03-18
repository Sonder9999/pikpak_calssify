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

export interface ScanArtifacts {
  files: FileEntry[];
  skipped: SkippedFileEntry[];
  createdAt: string;
}

export interface FolderSuggestions {
  folders: string[];
  createdAt: string;
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
}

export interface MovePlanGroup {
  folder: string;
  files: ClassificationEntry[];
}

export interface MovePlan {
  groups: MovePlanGroup[];
  totalFiles: number;
  createdAt: string;
}

export interface JobEvent {
  type: "status" | "log" | "result";
  timestamp: string;
  payload: unknown;
}

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  logs: string[];
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
