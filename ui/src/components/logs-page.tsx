import { useState } from "react";
import type { JobRecord } from "../../../src/types";
import {
  formatConsoleTime,
  getConsoleCopy,
  getStepTitle,
  translateJobStatus,
  type ConsoleLocale,
} from "../lib/console-i18n";
import { buildStructuredLogFeed } from "../lib/dashboard-view-model";
import { ActionButton, EmptyState, SectionCard, StatGrid } from "./cards";
import { StepPage } from "./step-page";

export function LogsPage({
  jobs,
  locale,
  onRefresh,
}: {
  jobs: JobRecord[];
  locale: ConsoleLocale;
  onRefresh: () => void;
}) {
  const copy = getConsoleCopy(locale);
  const [stepFilter, setStepFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const entries = buildStructuredLogFeed(jobs).filter((entry) => {
    if (stepFilter !== "all" && entry.step !== stepFilter) return false;
    if (levelFilter !== "all" && entry.level !== levelFilter) return false;
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    return true;
  });

  const uniqueSteps = ["all", ...new Set(entries.map((entry) => entry.step))];
  const errorCount = entries.filter((entry) => entry.level === "error").length;

  return (
    <StepPage
      description={copy.pages.logs.description}
      locale={locale}
      showAutoSaveNote={false}
      title={copy.pages.logs.title}
      actions={
        <ActionButton onClick={onRefresh}>
          {locale === "zh-CN" ? "刷新日志" : "Refresh logs"}
        </ActionButton>
      }
    >
      <SectionCard title={locale === "zh-CN" ? "活动摘要" : "Activity Summary"}>
        <StatGrid
          items={[
            {
              label: locale === "zh-CN" ? "任务数" : "Jobs",
              value: String(jobs.length),
              hint:
                locale === "zh-CN"
                  ? "当前内存中的任务历史"
                  : "In-memory job history",
            },
            {
              label: locale === "zh-CN" ? "可见事件" : "Visible Events",
              value: String(entries.length),
              hint: locale === "zh-CN" ? "应用当前筛选后" : "After current filters",
            },
            {
              label: locale === "zh-CN" ? "错误数" : "Errors",
              value: String(errorCount),
              hint:
                locale === "zh-CN"
                  ? "结构化错误日志条目"
                  : "Structured error entries",
              tone: errorCount > 0 ? "error" : "default",
            },
            {
              label: locale === "zh-CN" ? "最近更新" : "Latest Update",
              value: entries[0]?.timestamp
                ? formatConsoleTime(locale, entries[0].timestamp, copy.common.noData)
                : locale === "zh-CN"
                  ? "暂无日志"
                  : "No logs yet",
            },
          ]}
        />
      </SectionCard>

      <SectionCard title={locale === "zh-CN" ? "筛选器" : "Filters"}>
        <div className="grid two-column-grid">
          <label className="field">
            <span className="field-label">{locale === "zh-CN" ? "步骤" : "Step"}</span>
            <select
              className="field-input"
              onChange={(event) => setStepFilter(event.target.value)}
              value={stepFilter}
            >
              {uniqueSteps.map((step) => (
                <option key={step} value={step}>
                  {step === "all"
                    ? locale === "zh-CN"
                      ? "全部"
                      : "All"
                    : getStepTitle(locale, step as Parameters<typeof getStepTitle>[1])}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">{locale === "zh-CN" ? "级别" : "Level"}</span>
            <select
              className="field-input"
              onChange={(event) => setLevelFilter(event.target.value)}
              value={levelFilter}
            >
              <option value="all">{locale === "zh-CN" ? "全部" : "All"}</option>
              <option value="info">{copy.common.levelInfo}</option>
              <option value="warn">{copy.common.levelWarn}</option>
              <option value="error">{copy.common.levelError}</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">{locale === "zh-CN" ? "任务状态" : "Job Status"}</span>
            <select
              className="field-input"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">{locale === "zh-CN" ? "全部" : "All"}</option>
              <option value="pending">{copy.status.pending}</option>
              <option value="running">{copy.status.running}</option>
              <option value="cancelling">{copy.status.cancelling}</option>
              <option value="completed">{copy.status.completed}</option>
              <option value="failed">{copy.status.failed}</option>
              <option value="cancelled">{copy.status.cancelled}</option>
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard title={locale === "zh-CN" ? "结构化日志" : "Structured Logs"}>
        {entries.length === 0 ? (
          <EmptyState
            text={
              locale === "zh-CN"
                ? "当前筛选条件下没有匹配的日志。"
                : "No log entries match the current filters."
            }
          />
        ) : (
          <div className="structured-log-viewer">
            {entries.map((entry) => (
              <article
                key={`${entry.jobId}-${entry.timestamp}-${entry.message}`}
                className={`log-entry level-${entry.level}`}
              >
                <div className="log-entry-head">
                  <div className="log-entry-meta">
                    <span className="pill">
                      {entry.level === "info"
                        ? copy.common.levelInfo
                        : entry.level === "warn"
                          ? copy.common.levelWarn
                          : copy.common.levelError}
                    </span>
                    <span className="pill muted">{getStepTitle(locale, entry.step)}</span>
                    <span className="log-timestamp">
                      {formatConsoleTime(locale, entry.timestamp, copy.common.noData)}
                    </span>
                  </div>
                  <span className="log-job-tag">
                    {getStepTitle(locale, entry.jobType)} · {translateJobStatus(locale, entry.status)}
                  </span>
                </div>
                <div className="log-entry-message">{entry.message}</div>
                {entry.context ? (
                  <details className="log-context">
                    <summary>{copy.common.context}</summary>
                    <div className="log-context-grid">
                      {Object.entries(entry.context).map(([key, value]) => (
                        <div key={key} className="context-row">
                          <span>{key}</span>
                          <strong>{String(value)}</strong>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </StepPage>
  );
}
