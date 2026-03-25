import type {
  ClassificationArtifacts,
  FolderSuggestions,
  JobRecord,
  MovePlan,
  ScanArtifacts,
} from "../../../src/types";

export type ThemePreference = "light" | "dark";

export type WorkflowStepStatus =
  | "locked"
  | "actionable"
  | "running"
  | "completed"
  | "failed";

export interface WorkflowStepModel {
  id: "scan" | "folders" | "classify" | "dry-run" | "move";
  index: number;
  title: string;
  description: string;
  status: WorkflowStepStatus;
  summary: string;
}

export interface WorkflowArtifactsSnapshot {
  scan?: ScanArtifacts | null;
  folderSuggestions?: FolderSuggestions | null;
  classification?: ClassificationArtifacts | null;
  movePlan?: MovePlan | null;
  currentJob?: Pick<JobRecord, "type" | "status" | "logs" | "error"> | null;
  currentMoveMode?: "dry-run" | "move" | null;
}

const workflowConfig = [
  {
    id: "scan",
    title: "扫描文件",
    description: "拉取源目录文件并生成扫描结果",
  },
  {
    id: "folders",
    title: "目录建议",
    description: "基于扫描结果生成建议分类目录",
  },
  {
    id: "classify",
    title: "执行分类",
    description: "生成分类结果并建立移动计划",
  },
  {
    id: "dry-run",
    title: "预演移动",
    description: "在不真实移动的情况下检查计划",
  },
  {
    id: "move",
    title: "正式移动",
    description: "执行最终移动操作",
  },
] as const;

function validTheme(
  value: string | null | undefined,
): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function summarizeStepMessage(message: string, maxLength = 120) {
  const normalized = message.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
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

function deriveRunningSummary(
  job: WorkflowArtifactsSnapshot["currentJob"],
): string {
  if (!job) return "";

  if (job.status === "failed") {
    return summarizeStepMessage(job.error || "任务执行失败");
  }

  return summarizeStepMessage(job.logs?.at(-1) || "任务执行中");
}

function isCompleted(
  job: WorkflowArtifactsSnapshot["currentJob"],
  type: string,
) {
  return job?.type === type && job.status === "completed";
}

export function buildWorkflowSteps(
  snapshot: WorkflowArtifactsSnapshot,
): WorkflowStepModel[] {
  const scanReady = Boolean(snapshot.scan?.files?.length);
  const foldersReady = Boolean(snapshot.folderSuggestions?.folders?.length);
  const classifyReady = Boolean(snapshot.classification?.items?.length);
  const planReady = Boolean(snapshot.movePlan?.totalFiles);
  const currentJob = snapshot.currentJob;
  const currentMoveMode = snapshot.currentMoveMode;

  return workflowConfig.map((step, index) => {
    if (step.id === "scan") {
      if (currentJob?.type === "scan" && currentJob.status !== "completed") {
        return {
          ...step,
          index: index + 1,
          status: currentJob.status === "failed" ? "failed" : "running",
          summary: deriveRunningSummary(currentJob),
        };
      }

      if (scanReady || isCompleted(currentJob, "scan")) {
        const fileCount = snapshot.scan?.files.length ?? 0;
        return {
          ...step,
          index: index + 1,
          status: "completed",
          summary: `已扫描 ${fileCount} 个文件`,
        };
      }

      return {
        ...step,
        index: index + 1,
        status: "actionable",
        summary: "开始扫描，生成本次流程的基础数据",
      };
    }

    if (step.id === "folders") {
      if (!scanReady && currentJob?.type !== "folders") {
        return {
          ...step,
          index: index + 1,
          status: "locked",
          summary: "先完成扫描，再生成目录建议",
        };
      }

      if (currentJob?.type === "folders" && currentJob.status !== "completed") {
        return {
          ...step,
          index: index + 1,
          status: currentJob.status === "failed" ? "failed" : "running",
          summary: deriveRunningSummary(currentJob),
        };
      }

      if (foldersReady || isCompleted(currentJob, "folders")) {
        const folderCount = snapshot.folderSuggestions?.folders.length ?? 0;
        return {
          ...step,
          index: index + 1,
          status: "completed",
          summary: `已生成 ${folderCount} 个目录建议`,
        };
      }

      return {
        ...step,
        index: index + 1,
        status: "actionable",
        summary: "根据扫描结果生成建议目录",
      };
    }

    if (step.id === "classify") {
      if (!scanReady && currentJob?.type !== "classify") {
        return {
          ...step,
          index: index + 1,
          status: "locked",
          summary: "先完成扫描，再执行分类",
        };
      }

      if (
        currentJob?.type === "classify" &&
        currentJob.status !== "completed"
      ) {
        return {
          ...step,
          index: index + 1,
          status: currentJob.status === "failed" ? "failed" : "running",
          summary: deriveRunningSummary(currentJob),
        };
      }

      if (classifyReady || isCompleted(currentJob, "classify")) {
        const itemCount = snapshot.classification?.items.length ?? 0;
        return {
          ...step,
          index: index + 1,
          status: "completed",
          summary: `已完成 ${itemCount} 个文件分类`,
        };
      }

      return {
        ...step,
        index: index + 1,
        status: "actionable",
        summary: "开始分类，并生成目标目录映射",
      };
    }

    if (step.id === "dry-run") {
      if (!classifyReady && currentJob?.type !== "move") {
        return {
          ...step,
          index: index + 1,
          status: "locked",
          summary: "先完成分类，再预演移动",
        };
      }

      if (currentJob?.type === "move" && currentJob.status !== "completed") {
        return {
          ...step,
          index: index + 1,
          status:
            currentMoveMode === "dry-run"
              ? currentJob.status === "failed"
                ? "failed"
                : "running"
              : planReady
                ? "completed"
                : "actionable",
          summary:
            currentMoveMode === "dry-run"
              ? deriveRunningSummary(currentJob)
              : `已准备 ${snapshot.movePlan?.totalFiles ?? 0} 个文件的移动计划`,
        };
      }

      if (
        planReady ||
        (currentJob?.type === "move" && currentMoveMode === "dry-run")
      ) {
        return {
          ...step,
          index: index + 1,
          status: "completed",
          summary: `已准备 ${snapshot.movePlan?.totalFiles ?? 0} 个文件的移动计划`,
        };
      }

      return {
        ...step,
        index: index + 1,
        status: "actionable",
        summary: "先进行 Dry Run，确认即将移动的内容",
      };
    }

    if (!planReady && currentJob?.type !== "move") {
      return {
        ...step,
        index: index + 1,
        status: "locked",
        summary: "先预演移动，再执行正式移动",
      };
    }

    if (currentJob?.type === "move") {
      if (currentMoveMode === "dry-run") {
        return {
          ...step,
          index: index + 1,
          status: planReady ? "actionable" : "locked",
          summary: planReady
            ? `Dry Run 已完成，准备执行 ${snapshot.movePlan?.totalFiles ?? 0} 个文件的正式移动`
            : "先预演移动，再执行正式移动",
        };
      }

      if (currentJob.status === "completed") {
        return {
          ...step,
          index: index + 1,
          status: "completed",
          summary: `已完成 ${snapshot.movePlan?.totalFiles ?? 0} 个文件的移动流程`,
        };
      }

      return {
        ...step,
        index: index + 1,
        status: currentJob.status === "failed" ? "failed" : "running",
        summary: deriveRunningSummary(currentJob),
      };
    }

    return {
      ...step,
      index: index + 1,
      status: "actionable",
      summary: `准备执行 ${snapshot.movePlan?.totalFiles ?? 0} 个文件的正式移动`,
    };
  });
}
