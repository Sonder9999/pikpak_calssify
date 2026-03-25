import type {
  JobLogEntry,
  JobRecord,
  WorkflowStepId,
  WorkflowSummaryResponse,
} from "../../../src/types";
import { getConsoleCopy, getStepTitle, type ConsoleLocale } from "./console-i18n";

export type ThemePreference = "light" | "dark";
export type ConsolePageId = WorkflowStepId | "logs";

export interface ConsolePageModel {
  id: ConsolePageId;
  title: string;
  statusLabel: string;
  countLabel?: string;
  stale: boolean;
  canRun: boolean;
  hasArtifact: boolean;
  running: boolean;
}

export interface StructuredLogViewModel extends JobLogEntry {
  jobId: string;
  jobType: string;
  status: JobRecord["status"];
}

const PAGE_ORDER: WorkflowStepId[] = [
  "scan",
  "folders",
  "classify",
  "dry-run",
  "move",
];

function validTheme(
  value: string | null | undefined,
): value is ThemePreference {
  return value === "light" || value === "dark";
}

function isRunning(status: JobRecord["status"]) {
  return (
    status === "pending" || status === "running" || status === "cancelling"
  );
}

function sortJobsLatestFirst(jobs: JobRecord[]) {
  return [...jobs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function resolveThemePreference(
  storedTheme: string | null | undefined,
  systemPrefersDark: boolean,
): ThemePreference {
  if (validTheme(storedTheme)) {
    return storedTheme;
  }

  return systemPrefersDark ? "dark" : "light";
}

export function getLatestStepJob(stepId: WorkflowStepId, jobs: JobRecord[]) {
  return sortJobsLatestFirst(jobs).find((job) => job.type === stepId) ?? null;
}

export function buildStructuredLogFeed(jobs: JobRecord[]) {
  return jobs
    .flatMap((job) => {
      const entries =
        job.logEntries && job.logEntries.length > 0
          ? job.logEntries
          : job.logs.map(
              (message, index): StructuredLogViewModel => ({
                level: "info",
                step: job.type,
                message,
                timestamp: `${job.updatedAt}:${index}`,
                jobId: job.id,
                jobType: job.type,
                status: job.status,
              }),
            );

      return entries.map(
        (entry): StructuredLogViewModel => ({
          ...entry,
          jobId: job.id,
          jobType: job.type,
          status: job.status,
        }),
      );
    })
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export function buildConsolePages(
  summary: WorkflowSummaryResponse,
  locale: ConsoleLocale = "zh-CN",
) {
  const copy = getConsoleCopy(locale);
  const stepPages: ConsolePageModel[] = PAGE_ORDER.map((stepId) => {
    const step = summary.steps[stepId];
    const latestJob = getLatestStepJob(stepId, summary.jobs);
    const running = latestJob ? isRunning(latestJob.status) : false;

    let statusLabel = copy.common.locked;
    if (running) {
      statusLabel = copy.common.running;
    } else if (step.stale) {
      statusLabel = copy.common.stale;
    } else if (step.hasArtifact) {
      statusLabel = copy.common.ready;
    } else if (step.canRun) {
      statusLabel = copy.common.available;
    }

    return {
      id: stepId,
      title: getStepTitle(locale, stepId),
      statusLabel,
      countLabel: step.artifactUpdatedAt ? copy.common.current : undefined,
      stale: step.stale,
      canRun: step.canRun,
      hasArtifact: step.hasArtifact,
      running,
    };
  });

  const logs = buildStructuredLogFeed(summary.jobs);
  const logsPage: ConsolePageModel = {
    id: "logs",
    title: getStepTitle(locale, "logs"),
    statusLabel: logs.length > 0 ? copy.common.current : copy.common.noData,
    countLabel: copy.counts.events(logs.length),
    stale: false,
    canRun: true,
    hasArtifact: logs.length > 0,
    running: summary.jobs.some((job) => isRunning(job.status)),
  };

  return [...stepPages, logsPage];
}
