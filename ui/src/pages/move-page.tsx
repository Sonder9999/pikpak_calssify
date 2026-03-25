import type {
  JobRecord,
  RuntimeSettingsPayload,
  WorkflowStepSummary,
} from "../../../src/types";
import {
  getConsoleCopy,
  translateJobStatus,
  type ConsoleLocale,
} from "../lib/console-i18n";
import {
  ActionButton,
  DataList,
  EmptyState,
  Field,
  SectionCard,
  StatGrid,
} from "../components/cards";
import { StatusPanel } from "../components/status-panel";
import { StepPage } from "../components/step-page";
import { summarizeLogLine } from "./page-helpers";

export function MovePage({
  locale,
  runtimeSettings,
  movePlan,
  summary,
  latestJob,
  isRefreshing,
  isSaving,
  onRefresh,
  onSave,
  onRun,
  onStop,
  updateRuntimeSection,
}: {
  locale: ConsoleLocale;
  runtimeSettings: RuntimeSettingsPayload;
  movePlan: {
    groups: Array<{
      folder: string;
      files: Array<{ name: string; path: string }>;
    }>;
    totalFiles: number;
    createdAt?: string;
  } | null;
  summary: WorkflowStepSummary;
  latestJob: JobRecord | null;
  isRefreshing: boolean;
  isSaving: boolean;
  onRefresh: () => void;
  onSave: () => void;
  onRun: () => void;
  onStop: () => void;
  updateRuntimeSection: <T extends keyof RuntimeSettingsPayload>(
    section: T,
    field: keyof RuntimeSettingsPayload[T],
    value: RuntimeSettingsPayload[T][keyof RuntimeSettingsPayload[T]],
  ) => void;
}) {
  const copy = getConsoleCopy(locale);

  return (
    <StepPage
      description={copy.pages.move.description}
      locale={locale}
      title={copy.pages.move.title}
      actions={
        <>
          <ActionButton onClick={onRefresh}>
            {isRefreshing
              ? copy.common.refreshing
              : locale === "zh-CN"
                ? "刷新移动"
                : "Refresh move"}
          </ActionButton>
          <ActionButton onClick={onSave} tone="primary">
            {isSaving ? copy.common.saving : copy.common.saveSettings}
          </ActionButton>
          <ActionButton onClick={onRun} tone="primary">
            {locale === "zh-CN" ? "开始移动" : "Start move"}
          </ActionButton>
          <ActionButton onClick={onStop} tone="danger">
            {locale === "zh-CN" ? "停止移动" : "Stop move"}
          </ActionButton>
        </>
      }
    >
      <StatusPanel
        items={[
          {
            label: locale === "zh-CN" ? "当前目标目录" : "Current Target",
            value: runtimeSettings.pikpak.targetFolder || copy.common.unset,
            hint:
              locale === "zh-CN"
                ? "PikPak 中的最终目标根目录"
                : "Final destination root in PikPak",
          },
        ]}
        latestJob={latestJob}
        locale={locale}
        summary={summary}
      />

      <SectionCard title={locale === "zh-CN" ? "执行设置" : "Execution Settings"}>
        <div className="grid compact-three-grid">
          <Field label={locale === "zh-CN" ? "目标目录" : "Target Folder"}>
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection(
                  "pikpak",
                  "targetFolder",
                  event.target.value,
                )
              }
              value={runtimeSettings.pikpak.targetFolder}
            />
          </Field>
          <Field label={locale === "zh-CN" ? "移动批大小" : "Move Batch Size"}>
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection(
                  "workflow",
                  "moveBatchSize",
                  Number(event.target.value),
                )
              }
              type="number"
              value={runtimeSettings.workflow.moveBatchSize}
            />
          </Field>
          <Field label={locale === "zh-CN" ? "最小延迟（毫秒）" : "Min Delay (ms)"}>
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection(
                  "workflow",
                  "moveMinDelayMs",
                  Number(event.target.value),
                )
              }
              type="number"
              value={runtimeSettings.workflow.moveMinDelayMs}
            />
          </Field>
          <Field label={locale === "zh-CN" ? "最大延迟（毫秒）" : "Max Delay (ms)"}>
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection(
                  "workflow",
                  "moveMaxDelayMs",
                  Number(event.target.value),
                )
              }
              type="number"
              value={runtimeSettings.workflow.moveMaxDelayMs}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title={locale === "zh-CN" ? "执行摘要" : "Execution Summary"}>
        <StatGrid
          items={[
            {
              label: locale === "zh-CN" ? "最近移动状态" : "Latest Move Status",
              value: translateJobStatus(locale, latestJob?.status),
              hint: summarizeLogLine(locale, latestJob),
            },
            {
              label: locale === "zh-CN" ? "计划文件数" : "Planned Files",
              value: String(movePlan?.totalFiles ?? 0),
              hint:
                locale === "zh-CN"
                  ? "最近一次生成的移动计划"
                  : "The latest generated move plan",
            },
          ]}
        />
        {latestJob?.result ? (
          <DataList
            emptyText={locale === "zh-CN" ? "暂无移动结果。" : "No move result yet."}
            items={Object.entries(
              latestJob.result as Record<string, unknown>,
            ).map(([key, value]) => ({
              title: key,
              detail: String(value),
              }))}
          />
        ) : (
          <EmptyState
            text={
              locale === "zh-CN"
                ? "执行移动步骤后，这里会展示结果摘要。"
                : "Run the move step to capture an execution result."
            }
          />
        )}
      </SectionCard>
    </StepPage>
  );
}
