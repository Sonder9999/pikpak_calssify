import type {
  CategoryFolderLibrary,
  ClassificationArtifacts,
  JobRecord,
  PromptSettings,
  RuntimeSettingsPayload,
  WorkflowStepSummary,
} from "../../../src/types";
import type { HealthResponse } from "../lib/api";
import type { ConsoleLocale } from "../lib/console-i18n";
import type { ConsolePageId } from "../lib/dashboard-view-model";
import { LogsPage } from "../components/logs-page";
import { ClassificationPage } from "./classification-page";
import { DryRunPage } from "./dry-run-page";
import { FolderSuggestionsPage } from "./folder-suggestions-page";
import { MovePage } from "./move-page";
import { ScanPage } from "./scan-page";

export function PageRouter(props: {
  activePage: ConsolePageId;
  locale: ConsoleLocale;
  health: HealthResponse | null;
  runtimeSettings: RuntimeSettingsPayload;
  prompts: PromptSettings;
  categories: CategoryFolderLibrary;
  scan: import("../../../src/types").ScanArtifacts | null;
  folderSuggestions: { folders: string[]; createdAt?: string } | null;
  classification: ClassificationArtifacts | null;
  movePlan: {
    groups: Array<{
      folder: string;
      files: Array<{ name: string; path: string }>;
    }>;
    totalFiles: number;
    createdAt?: string;
  } | null;
  summaries: Record<ConsolePageId | "logs", WorkflowStepSummary | undefined>;
  jobs: {
    scan: JobRecord | null;
    folders: JobRecord | null;
    classify: JobRecord | null;
    "dry-run": JobRecord | null;
    move: JobRecord | null;
    all: JobRecord[];
  };
  isRefreshing: boolean;
  isSaving: boolean;
  onRefresh: () => void;
  onSaveScan: () => void;
  onSaveFolders: () => void;
  onSaveClassification: () => void;
  onSaveDryRun: () => void;
  onSaveMove: () => void;
  onResetPrompts: () => void;
  onRun: (action: import("../lib/api").WorkflowAction) => void;
  onStop: (page: "scan" | "folders" | "classify" | "dry-run" | "move") => void;
  onSyncCategories: () => void;
  onUpdateFolderSuggestionPrompt: (value: string) => void;
  onUpdateClassificationPrompt: (value: string) => void;
  onUpdateCategoryLibrary: (value: string) => void;
  updateRuntimeSection: <T extends keyof RuntimeSettingsPayload>(
    page: Exclude<ConsolePageId, "logs">,
    section: T,
    field: keyof RuntimeSettingsPayload[T],
    value: RuntimeSettingsPayload[T][keyof RuntimeSettingsPayload[T]],
  ) => void;
}) {
  switch (props.activePage) {
    case "scan":
      return (
        <ScanPage
          health={props.health}
          isRefreshing={props.isRefreshing}
          isSaving={props.isSaving}
          latestJob={props.jobs.scan}
          locale={props.locale}
          onRefresh={props.onRefresh}
          onRun={() => props.onRun("scan")}
          onSave={props.onSaveScan}
          onStop={() => props.onStop("scan")}
          runtimeSettings={props.runtimeSettings}
          scan={props.scan}
          summary={props.summaries.scan!}
          updateRuntimeSection={(section, field, value) =>
            props.updateRuntimeSection("scan", section, field, value)
          }
        />
      );
    case "folders":
      return (
        <FolderSuggestionsPage
          categories={props.categories}
          folderSuggestions={props.folderSuggestions}
          health={props.health}
          isRefreshing={props.isRefreshing}
          isSaving={props.isSaving}
          latestJob={props.jobs.folders}
          locale={props.locale}
          onRefresh={props.onRefresh}
          onRun={() => props.onRun("folders")}
          onSave={props.onSaveFolders}
          onStop={() => props.onStop("folders")}
          onSyncCategories={props.onSyncCategories}
          onUpdateCategoryLibrary={props.onUpdateCategoryLibrary}
          onUpdateFolderSuggestionPrompt={props.onUpdateFolderSuggestionPrompt}
          prompts={props.prompts}
          runtimeSettings={props.runtimeSettings}
          summary={props.summaries.folders!}
          updateRuntimeSection={(section, field, value) =>
            props.updateRuntimeSection("folders", section, field, value)
          }
        />
      );
    case "classify":
      return (
        <ClassificationPage
          categories={props.categories}
          classification={props.classification}
          health={props.health}
          isRefreshing={props.isRefreshing}
          isSaving={props.isSaving}
          latestJob={props.jobs.classify}
          locale={props.locale}
          onRefresh={props.onRefresh}
          onResetPrompts={props.onResetPrompts}
          onRun={() => props.onRun("classify")}
          onSave={props.onSaveClassification}
          onStop={() => props.onStop("classify")}
          onUpdateClassificationPrompt={props.onUpdateClassificationPrompt}
          prompts={props.prompts}
          runtimeSettings={props.runtimeSettings}
          summary={props.summaries.classify!}
          updateRuntimeSection={(section, field, value) =>
            props.updateRuntimeSection("classify", section, field, value)
          }
        />
      );
    case "dry-run":
      return (
        <DryRunPage
          isRefreshing={props.isRefreshing}
          isSaving={props.isSaving}
          latestJob={props.jobs["dry-run"]}
          locale={props.locale}
          movePlan={props.movePlan}
          onRefresh={props.onRefresh}
          onRun={() => props.onRun("dry-run")}
          onSave={props.onSaveDryRun}
          onStop={() => props.onStop("dry-run")}
          runtimeSettings={props.runtimeSettings}
          summary={props.summaries["dry-run"]!}
          updateRuntimeSection={(section, field, value) =>
            props.updateRuntimeSection("dry-run", section, field, value)
          }
        />
      );
    case "move":
      return (
        <MovePage
          isRefreshing={props.isRefreshing}
          isSaving={props.isSaving}
          latestJob={props.jobs.move}
          locale={props.locale}
          movePlan={props.movePlan}
          onRefresh={props.onRefresh}
          onRun={() => props.onRun("move")}
          onSave={props.onSaveMove}
          onStop={() => props.onStop("move")}
          runtimeSettings={props.runtimeSettings}
          summary={props.summaries.move!}
          updateRuntimeSection={(section, field, value) =>
            props.updateRuntimeSection("move", section, field, value)
          }
        />
      );
    case "logs":
      return (
        <LogsPage
          jobs={props.jobs.all}
          locale={props.locale}
          onRefresh={props.onRefresh}
        />
      );
    default:
      return null;
  }
}
