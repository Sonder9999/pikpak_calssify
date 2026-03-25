import type { JobRecord, WorkflowStepSummary } from "../../../src/types";
import {
  formatConsoleTime,
  getConsoleCopy,
  translateJobStatus,
  type ConsoleLocale,
} from "../lib/console-i18n";
import { StatGrid } from "./cards";

export function StatusPanel({
  summary,
  latestJob,
  items,
  locale,
}: {
  summary: WorkflowStepSummary;
  latestJob?: JobRecord | null;
  items: Array<{ label: string; value: string; hint?: string }>;
  locale: ConsoleLocale;
}) {
  const copy = getConsoleCopy(locale);
  const tone = summary.stale
    ? "warn"
    : latestJob?.status === "failed"
      ? "error"
      : summary.hasArtifact
        ? "success"
        : "default";

  return (
    <StatGrid
      items={[
        {
          label: locale === "zh-CN" ? "产物" : "Artifact",
          value: summary.hasArtifact ? copy.common.available : copy.common.missing,
          hint: formatConsoleTime(
            locale,
            summary.artifactUpdatedAt,
            copy.common.noArtifact,
          ),
          tone,
        },
        {
          label: locale === "zh-CN" ? "时效" : "Freshness",
          value: summary.stale ? copy.common.stale : copy.common.current,
          hint: summary.staleReason ?? copy.common.inputsAligned,
          tone: summary.stale ? "warn" : "default",
        },
        {
          label: locale === "zh-CN" ? "最近任务" : "Latest Job",
          value: translateJobStatus(locale, latestJob?.status),
          hint: latestJob?.updatedAt
            ? formatConsoleTime(locale, latestJob.updatedAt, copy.common.noRecentJob)
            : copy.common.noRecentJob,
        },
        ...items,
      ]}
    />
  );
}
