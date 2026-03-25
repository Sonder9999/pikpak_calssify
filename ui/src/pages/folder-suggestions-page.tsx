import type {
  CategoryFolderLibrary,
  JobRecord,
  PromptSettings,
  RuntimeSettingsPayload,
  WorkflowStepSummary,
} from "../../../src/types";
import type { HealthResponse } from "../lib/api";
import {
  getConsoleCopy,
  translateJobStatus,
  type ConsoleLocale,
} from "../lib/console-i18n";
import {
  ActionButton,
  ChipList,
  Field,
  SectionCard,
  StatGrid,
} from "../components/cards";
import { StatusPanel } from "../components/status-panel";
import { StepPage } from "../components/step-page";
import { formatTime, summarizeLogLine } from "./page-helpers";

export function FolderSuggestionsPage({
  locale,
  health,
  runtimeSettings,
  prompts,
  categories,
  folderSuggestions,
  summary,
  latestJob,
  isRefreshing,
  isSaving,
  onRefresh,
  onSave,
  onRun,
  onStop,
  onSyncCategories,
  onUpdateFolderSuggestionPrompt,
  onUpdateCategoryLibrary,
  updateRuntimeSection,
}: {
  locale: ConsoleLocale;
  health: HealthResponse | null;
  runtimeSettings: RuntimeSettingsPayload;
  prompts: PromptSettings;
  categories: CategoryFolderLibrary;
  folderSuggestions: { folders: string[]; createdAt?: string } | null;
  summary: WorkflowStepSummary;
  latestJob: JobRecord | null;
  isRefreshing: boolean;
  isSaving: boolean;
  onRefresh: () => void;
  onSave: () => void;
  onRun: () => void;
  onStop: () => void;
  onSyncCategories: () => void;
  onUpdateFolderSuggestionPrompt: (value: string) => void;
  onUpdateCategoryLibrary: (value: string) => void;
  updateRuntimeSection: <T extends keyof RuntimeSettingsPayload>(
    section: T,
    field: keyof RuntimeSettingsPayload[T],
    value: RuntimeSettingsPayload[T][keyof RuntimeSettingsPayload[T]],
  ) => void;
}) {
  const copy = getConsoleCopy(locale);

  return (
    <StepPage
      description={copy.pages.folders.description}
      locale={locale}
      title={copy.pages.folders.title}
      actions={
        <>
          <ActionButton onClick={onRefresh}>
            {isRefreshing
              ? copy.common.refreshing
              : locale === "zh-CN"
                ? "刷新建议"
                : "Refresh suggestions"}
          </ActionButton>
          <ActionButton onClick={onSave} tone="primary">
            {isSaving ? copy.common.saving : copy.common.savePage}
          </ActionButton>
          <ActionButton onClick={onRun} tone="primary">
            {locale === "zh-CN" ? "生成建议" : "Generate suggestions"}
          </ActionButton>
          <ActionButton onClick={onStop} tone="danger">
            {locale === "zh-CN" ? "停止任务" : "Stop task"}
          </ActionButton>
        </>
      }
    >
      <StatusPanel
        items={[
          {
            label: locale === "zh-CN" ? "模型校验" : "LLM Validation",
            value: health?.llm.valid ? copy.common.ready : copy.common.missing,
            hint:
              health?.llm.errors.join(" | ") ||
              (locale === "zh-CN" ? "模型配置可用" : "LLM config available"),
          },
        ]}
        latestJob={latestJob}
        locale={locale}
        summary={summary}
      />

      <SectionCard
        actions={
          <ActionButton onClick={onSyncCategories}>
            {locale === "zh-CN" ? "同步分类库" : "Sync categories"}
          </ActionButton>
        }
        description={
          locale === "zh-CN"
            ? "这一页维护可复用的分类库和文件夹建议提示词。"
            : "This page owns the reusable category library and the folder suggestion prompt."
        }
        title={locale === "zh-CN" ? "建议输入" : "Suggestion Inputs"}
      >
        <form
          className="grid two-column-grid"
          onSubmit={(event) => event.preventDefault()}
        >
          <Field label={locale === "zh-CN" ? "LLM API Key" : "LLM API Key"}>
            <input
              autoComplete="current-password"
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection("llm", "apiKey", event.target.value)
              }
              type="password"
              value={runtimeSettings.llm.apiKey}
            />
          </Field>
          <Field label={locale === "zh-CN" ? "模型" : "Model"}>
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection("llm", "model", event.target.value)
              }
              value={runtimeSettings.llm.model}
            />
          </Field>
          <Field label="Base URL">
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection("llm", "baseUrl", event.target.value)
              }
              value={runtimeSettings.llm.baseUrl}
            />
          </Field>
          <Field label={locale === "zh-CN" ? "批大小" : "Batch Size"}>
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection(
                  "workflow",
                  "batchSize",
                  Number(event.target.value),
                )
              }
              type="number"
              value={runtimeSettings.workflow.batchSize}
            />
          </Field>
          <Field
            className="full-span"
            label={locale === "zh-CN" ? "文件夹建议提示词" : "Folder Suggestion Prompt"}
          >
            <textarea
              className="field-input field-textarea"
              onChange={(event) =>
                onUpdateFolderSuggestionPrompt(event.target.value)
              }
              value={prompts.folderSuggestion}
            />
          </Field>
          <Field
            className="full-span"
            label={locale === "zh-CN" ? "分类库" : "Category Library"}
          >
            <textarea
              className="field-input field-textarea"
              onChange={(event) => onUpdateCategoryLibrary(event.target.value)}
              value={categories.folders.join("\n")}
            />
          </Field>
        </form>
      </SectionCard>

      <SectionCard title={locale === "zh-CN" ? "建议结果" : "Suggested Folders"}>
        <StatGrid
          items={[
            {
              label: locale === "zh-CN" ? "建议数量" : "Suggestions",
              value: String(folderSuggestions?.folders.length ?? 0),
              hint: formatTime(locale, folderSuggestions?.createdAt),
            },
            {
              label: locale === "zh-CN" ? "分类库条目" : "Library Size",
              value: String(categories.folders.length),
              hint: formatTime(locale, categories.updatedAt),
            },
            {
              label: copy.common.recentLog,
              value: translateJobStatus(locale, latestJob?.status),
              hint: summarizeLogLine(locale, latestJob),
            },
          ]}
        />
        <ChipList
          emptyText={
            locale === "zh-CN"
              ? "执行建议生成后，这里会显示推荐文件夹。"
              : "Generate folder suggestions to populate this grid."
          }
          items={folderSuggestions?.folders ?? []}
        />
      </SectionCard>
    </StepPage>
  );
}
