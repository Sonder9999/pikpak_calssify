import type {
  JobRecord,
  RuntimeSettingsPayload,
  WorkflowStepSummary,
} from "../../../src/types";
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
} from "../components/cards";
import { StatusPanel } from "../components/status-panel";
import { StepPage } from "../components/step-page";
import { formatTime, summarizeLogLine } from "./page-helpers";

export function DryRunPage({
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
      description={copy.pages["dry-run"].description}
      locale={locale}
      title={copy.pages["dry-run"].title}
      actions={
        <>
          <ActionButton onClick={onRefresh}>
            {isRefreshing
              ? copy.common.refreshing
              : locale === "zh-CN"
                ? "刷新预演"
                : "Refresh dry run"}
          </ActionButton>
          <ActionButton onClick={onSave} tone="primary">
            {isSaving ? copy.common.saving : copy.common.saveSettings}
          </ActionButton>
          <ActionButton onClick={onRun} tone="primary">
            {locale === "zh-CN" ? "执行预演" : "Execute dry run"}
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
            label: locale === "zh-CN" ? "移动计划" : "Move Plan",
            value: String(movePlan?.groups.length ?? 0),
            hint: formatTime(locale, movePlan?.createdAt),
          },
        ]}
        latestJob={latestJob}
        locale={locale}
        summary={summary}
      />

      <SectionCard title={locale === "zh-CN" ? "预演设置" : "Move Preview Settings"}>
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

      <SectionCard title={locale === "zh-CN" ? "计划预览" : "Move Plan Preview"}>
        <StatGrid
          items={[
            {
              label: locale === "zh-CN" ? "总文件数" : "Total Files",
              value: String(movePlan?.totalFiles ?? 0),
              hint: summarizeLogLine(locale, latestJob),
            },
            {
              label: locale === "zh-CN" ? "分组数" : "Groups",
              value: String(movePlan?.groups.length ?? 0),
              hint:
                locale === "zh-CN"
                  ? "按目标目录分组"
                  : "Grouped by destination folder",
            },
          ]}
        />
        <DataList
          emptyText={
            locale === "zh-CN"
              ? "执行预演后，这里会显示按目录分组的移动计划。"
              : "Run a dry run to preview grouped file moves."
          }
          items={(movePlan?.groups ?? []).map((group) => ({
            title: group.folder,
            detail: copy.counts.files(group.files.length),
            extra: group.files
              .slice(0, 2)
              .map((file) => file.name)
              .join(" | "),
          }))}
        />
      </SectionCard>
    </StepPage>
  );
}
