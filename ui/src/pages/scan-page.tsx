import type {
  JobRecord,
  RuntimeSettingsPayload,
  ScanArtifacts,
  WorkflowStepSummary,
} from "../../../src/types";
import type { HealthResponse } from "../lib/api";
import { getConsoleCopy, type ConsoleLocale } from "../lib/console-i18n";
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

export function ScanPage({
  locale,
  health,
  runtimeSettings,
  scan,
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
  health: HealthResponse | null;
  runtimeSettings: RuntimeSettingsPayload;
  scan: ScanArtifacts | null;
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
      description={copy.pages.scan.description}
      locale={locale}
      title={copy.pages.scan.title}
      actions={
        <>
          <ActionButton onClick={onRefresh}>
            {isRefreshing
              ? copy.common.refreshing
              : locale === "zh-CN"
                ? "刷新扫描"
                : "Refresh scan"}
          </ActionButton>
          <ActionButton onClick={onSave} tone="primary">
            {isSaving ? copy.common.saving : copy.common.saveSettings}
          </ActionButton>
          <ActionButton onClick={onRun} tone="primary">
            {locale === "zh-CN" ? "开始扫描" : "Start scan"}
          </ActionButton>
          <ActionButton onClick={onStop} tone="danger">
            {locale === "zh-CN" ? "停止扫描" : "Stop scan"}
          </ActionButton>
        </>
      }
    >
      <StatusPanel
        items={[
          {
            label: locale === "zh-CN" ? "代理状态" : "Proxy",
            value: runtimeSettings.network.proxyUrl
              ? copy.common.enabled
              : copy.common.disabled,
            hint:
              runtimeSettings.network.proxyUrl ||
              (locale === "zh-CN" ? "未配置代理地址" : "No proxy configured"),
          },
        ]}
        latestJob={latestJob}
        locale={locale}
        summary={summary}
      />

      <SectionCard title={locale === "zh-CN" ? "连接设置" : "Connection Settings"}>
        <form
          className="grid two-column-grid"
          onSubmit={(event) => event.preventDefault()}
        >
          <Field label={locale === "zh-CN" ? "用户名" : "Username"}>
            <input
              autoComplete="username"
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection("pikpak", "username", event.target.value)
              }
              value={runtimeSettings.pikpak.username}
            />
          </Field>
          <Field label={locale === "zh-CN" ? "密码" : "Password"}>
            <input
              autoComplete="current-password"
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection("pikpak", "password", event.target.value)
              }
              type="password"
              value={runtimeSettings.pikpak.password}
            />
          </Field>
          <Field label={locale === "zh-CN" ? "源目录" : "Source Folder"}>
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection(
                  "pikpak",
                  "sourceFolder",
                  event.target.value,
                )
              }
              value={runtimeSettings.pikpak.sourceFolder}
            />
          </Field>
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
          <Field label={locale === "zh-CN" ? "设备 ID" : "Device ID"}>
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection("pikpak", "deviceId", event.target.value)
              }
              value={runtimeSettings.pikpak.deviceId ?? ""}
            />
          </Field>
          <Field label="Proxy URL">
            <input
              className="field-input"
              onChange={(event) =>
                updateRuntimeSection("network", "proxyUrl", event.target.value)
              }
              value={runtimeSettings.network.proxyUrl ?? ""}
            />
          </Field>
        </form>
      </SectionCard>

      <SectionCard title={locale === "zh-CN" ? "扫描结果" : "Scan Output"}>
        <StatGrid
          items={[
            {
              label: locale === "zh-CN" ? "可分类文件" : "Classifiable Files",
              value: String(scan?.files.length ?? 0),
              hint: formatTime(locale, scan?.createdAt),
            },
            {
              label: locale === "zh-CN" ? "跳过文件" : "Skipped",
              value: String(scan?.skipped.length ?? 0),
              hint: summarizeLogLine(locale, latestJob),
            },
            {
              label: locale === "zh-CN" ? "配置校验" : "Config Validation",
              value: health?.config.valid
                ? copy.common.ready
                : locale === "zh-CN"
                  ? "需处理"
                  : "Needs work",
              hint:
                health?.config.errors.join(" | ") ||
                (locale === "zh-CN" ? "运行配置已准备就绪" : "Runtime is valid"),
            },
          ]}
        />
        <DataList
          emptyText={
            locale === "zh-CN"
              ? "先执行扫描，这里会显示文件样本。"
              : "Run scan to see file samples."
          }
          items={(scan?.files ?? []).slice(0, 8).map((file) => ({
            title: file.name,
            detail: file.path,
            extra: `${file.durationSeconds}s`,
          }))}
        />
      </SectionCard>
    </StepPage>
  );
}
