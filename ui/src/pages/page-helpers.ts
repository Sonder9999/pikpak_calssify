import type { ClassificationArtifacts, JobRecord } from "../../../src/types";
import {
  formatConsoleTime,
  getConsoleCopy,
  type ConsoleLocale,
} from "../lib/console-i18n";

export function formatTime(locale: ConsoleLocale, value?: string) {
  return formatConsoleTime(locale, value, getConsoleCopy(locale).common.noData);
}

export function summarizeLogLine(locale: ConsoleLocale, job?: JobRecord | null) {
  const copy = getConsoleCopy(locale);
  if (!job) return copy.common.noRecentJob;
  const lastStructured = job.logEntries?.at(-1)?.message;
  const lastRaw = job.logs.at(-1);
  return lastStructured ?? lastRaw ?? copy.common.noLogEntries;
}

export function groupClassificationFolders(
  locale: ConsoleLocale,
  classification?: ClassificationArtifacts | null,
) {
  const copy = getConsoleCopy(locale);
  const groups = new Map<string, number>();
  for (const item of classification?.items ?? []) {
    groups.set(item.folder, (groups.get(item.folder) ?? 0) + 1);
  }

  return [...groups.entries()].map(([folder, count]) => ({
    title: folder,
    detail: copy.counts.files(count),
  }));
}
