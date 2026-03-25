import type {
  CategoryFolderLibrary,
  ClassificationArtifacts,
  JobRecord,
  PromptSettings,
  RuntimeSettingsPayload,
  WorkflowStepSummary,
} from "../../../src/types";
import type { HealthResponse } from "../lib/api";
import {
  getConsoleCopy,
  type ConsoleLocale,
} from "../lib/console-i18n";
import {
  ActionButton,
  DataList,
  Field,
  SectionCard,
  StatGrid,
  ToggleField,
} from "../components/cards";
import { StatusPanel } from "../components/status-panel";
import { StepPage } from "../components/step-page";
import {
  formatTime,
  groupClassificationFolders,
  summarizeLogLine,
} from "./page-helpers";

export function ClassificationPage({
  locale,
  health,
  runtimeSettings,
  prompts,
  categories,
  classification,
  summary,
  latestJob,
  isRefreshing,
  isSaving,
  onRefresh,
  onSave,
  onResetPrompts,
  onRun,
  onStop,
  onUpdateClassificationPrompt,
  updateRuntimeSection,
}: {
  locale: ConsoleLocale;
  health: HealthResponse | null;
  runtimeSettings: RuntimeSettingsPayload;
  prompts: PromptSettings;
  categories: CategoryFolderLibrary;
  classification: ClassificationArtifacts | null;
  summary: WorkflowStepSummary;
  latestJob: JobRecord | null;
  isRefreshing: boolean;
  isSaving: boolean;
  onRefresh: () => void;
  onSave: () => void;
  onResetPrompts: () => void;
  onRun: () => void;
  onStop: () => void;
  onUpdateClassificationPrompt: (value: string) => void;
  updateRuntimeSection: <T extends keyof RuntimeSettingsPayload>(
    section: T,
    field: keyof RuntimeSettingsPayload[T],
    value: RuntimeSettingsPayload[T][keyof RuntimeSettingsPayload[T]],
  ) => void;
}) {
  const copy = getConsoleCopy(locale);

  return (
    <StepPage
      description={copy.pages.classify.description}
      locale={locale}
      title={copy.pages.classify.title}
      actions={
        <>
          <ActionButton onClick={onRefresh}>
            {isRefreshing
              ? copy.common.refreshing
              : locale === "zh-CN"
                ? "刷新分类"
                : "Refresh classification"}
          </ActionButton>
          <ActionButton onClick={onSave} tone="primary">
            {isSaving ? copy.common.saving : copy.common.savePage}
          </ActionButton>
          <ActionButton onClick={onResetPrompts}>
            {locale === "zh-CN" ? "重置提示词" : "Reset prompts"}
          </ActionButton>
          <ActionButton onClick={onRun} tone="primary">
            {locale === "zh-CN" ? "执行分类" : "Run classification"}
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
            label: locale === "zh-CN" ? "可用分类数" : "Available Categories",
            value: String(categories.folders.length),
            hint:
              locale === "zh-CN"
                ? "在“文件夹建议”页维护"
                : "Managed on Folder Suggestions page",
          },
        ]}
        latestJob={latestJob}
        locale={locale}
        summary={summary}
      />

      <SectionCard title={locale === "zh-CN" ? "分类控制" : "Classification Controls"}>
        <form
          className="grid two-column-grid"
          onSubmit={(event) => event.preventDefault()}
        >
          <Field label="LLM API Key">
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
          <ToggleField
            checked={runtimeSettings.workflow.enableShortVideoFilter}
            hint={
              locale === "zh-CN"
                ? "短视频可以统一归入专用目录。"
                : "Short videos can be forced into a dedicated folder."
            }
            label={
              locale === "zh-CN"
                ? "启用短视频过滤"
                : "Enable Short Video Filter"
            }
            onChange={(checked) =>
              updateRuntimeSection(
                "workflow",
                "enableShortVideoFilter",
                checked,
              )
            }
          />
          <Field
            label={
              locale === "zh-CN"
                ? "短视频阈值（秒）"
                : "Short Video Threshold (s)"
            }
          >
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection(
                  "workflow",
                  "shortVideoThresholdSeconds",
                  Number(event.target.value),
                )
              }
              type="number"
              value={runtimeSettings.workflow.shortVideoThresholdSeconds}
            />
          </Field>
          <Field
            className="full-span"
            label={locale === "zh-CN" ? "分类提示词" : "Classification Prompt"}
          >
            <textarea
              className="field-input field-textarea"
              onChange={(event) =>
                onUpdateClassificationPrompt(event.target.value)
              }
              value={prompts.classification}
            />
          </Field>
        </form>
      </SectionCard>

      <SectionCard title={locale === "zh-CN" ? "分类结果" : "Classification Output"}>
        <StatGrid
          items={[
            {
              label: locale === "zh-CN" ? "已分类文件" : "Classified Files",
              value: String(classification?.items.length ?? 0),
              hint: formatTime(locale, classification?.createdAt),
            },
            {
              label: locale === "zh-CN" ? "使用目录" : "Folders Used",
              value: String(
                new Set(classification?.items.map((item) => item.folder) ?? [])
                  .size,
              ),
              hint: summarizeLogLine(locale, latestJob),
            },
            {
              label: locale === "zh-CN" ? "模型校验" : "LLM Validation",
              value: health?.llm.valid ? copy.common.ready : copy.common.missing,
              hint:
                health?.llm.errors.join(" | ") ||
                (locale === "zh-CN"
                  ? "模型访问配置已完成"
                  : "Model access configured"),
            },
          ]}
        />
        <DataList
          emptyText={
            locale === "zh-CN"
              ? "执行分类后，这里会展示按目录汇总的结果。"
              : "Run classification to see grouped folder results."
          }
          items={groupClassificationFolders(locale, classification)}
        />
      </SectionCard>
    </StepPage>
  );
}
