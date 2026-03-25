import type { JobRecord, WorkflowStepId } from "../../../src/types";

export type ConsoleLocale = "zh-CN" | "en-US";

interface StepCopy {
  title: string;
  description: string;
}

export interface ConsoleCopy {
  locale: ConsoleLocale;
  shell: {
    navLabel: string;
    pageKicker: string;
    themeToggle: string;
    languageToggle: string;
    switchToDark: string;
    switchToLight: string;
    switchToChinese: string;
    switchToEnglish: string;
    darkIcon: string;
    lightIcon: string;
    languageIcon: string;
  };
  common: {
    refreshing: string;
    saving: string;
    savePage: string;
    saveSettings: string;
    enabled: string;
    disabled: string;
    ready: string;
    missing: string;
    current: string;
    stale: string;
    available: string;
    locked: string;
    running: string;
    idle: string;
    unset: string;
    noData: string;
    noRecentJob: string;
    noLogEntries: string;
    noArtifact: string;
    inputsAligned: string;
    autoSaveOn: string;
    recentLog: string;
    levelInfo: string;
    levelWarn: string;
    levelError: string;
    context: string;
  };
  pages: Record<WorkflowStepId | "logs", StepCopy>;
  status: {
    pending: string;
    running: string;
    cancelling: string;
    completed: string;
    failed: string;
    cancelled: string;
  };
  counts: {
    files: (count: number) => string;
    events: (count: number) => string;
  };
}

const SUPPORTED_LOCALES: ConsoleLocale[] = ["zh-CN", "en-US"];

const COPY: Record<ConsoleLocale, ConsoleCopy> = {
  "zh-CN": {
    locale: "zh-CN",
    shell: {
      navLabel: "主导航",
      pageKicker: "PikPak 流程步骤",
      themeToggle: "切换主题",
      languageToggle: "切换语言",
      switchToDark: "切换深色主题",
      switchToLight: "切换浅色主题",
      switchToChinese: "切换为中文",
      switchToEnglish: "切换为英文",
      darkIcon: "☾",
      lightIcon: "☀",
      languageIcon: "文",
    },
    common: {
      refreshing: "刷新中...",
      saving: "保存中...",
      savePage: "保存本页",
      saveSettings: "保存设置",
      enabled: "已启用",
      disabled: "未启用",
      ready: "已就绪",
      missing: "缺失",
      current: "最新",
      stale: "需更新",
      available: "可执行",
      locked: "未解锁",
      running: "运行中",
      idle: "空闲",
      unset: "未设置",
      noData: "暂无数据",
      noRecentJob: "暂无最近任务",
      noLogEntries: "暂无日志",
      noArtifact: "无结果文件",
      inputsAligned: "当前输入与产物一致",
      autoSaveOn: "设置会自动保存到当前页面对应配置。",
      recentLog: "最近日志",
      levelInfo: "信息",
      levelWarn: "警告",
      levelError: "错误",
      context: "上下文",
    },
    pages: {
      scan: {
        title: "扫描",
        description: "配置 PikPak 连接、刷新源目录清单，并从已有扫描文件继续流程。",
      },
      folders: {
        title: "文件夹建议",
        description: "结合分类库与提示词生成目标文件夹建议，并把常用目录维护在这里。",
      },
      classify: {
        title: "分类",
        description: "基于最新扫描结果执行分类，把模型参数、分类提示词和短视频规则集中管理。",
      },
      "dry-run": {
        title: "预演",
        description: "预览移动计划、核对分组结果，再决定是否执行真实移动。",
      },
      move: {
        title: "移动",
        description: "只在分类和预演确认无误后执行真实移动，这一页只保留正式执行相关操作。",
      },
      logs: {
        title: "日志",
        description: "查看格式化后的流程历史，无需直接阅读 JSON 或原始文本输出。",
      },
    },
    status: {
      pending: "等待中",
      running: "运行中",
      cancelling: "停止中",
      completed: "已完成",
      failed: "失败",
      cancelled: "已停止",
    },
    counts: {
      files: (count) => `${count} 个文件`,
      events: (count) => `${count} 条事件`,
    },
  },
  "en-US": {
    locale: "en-US",
    shell: {
      navLabel: "Primary Navigation",
      pageKicker: "PikPak Workflow Step",
      themeToggle: "Toggle theme",
      languageToggle: "Toggle language",
      switchToDark: "Switch to dark theme",
      switchToLight: "Switch to light theme",
      switchToChinese: "Switch to Chinese",
      switchToEnglish: "Switch to English",
      darkIcon: "☾",
      lightIcon: "☀",
      languageIcon: "A",
    },
    common: {
      refreshing: "Refreshing...",
      saving: "Saving...",
      savePage: "Save page",
      saveSettings: "Save settings",
      enabled: "Enabled",
      disabled: "Disabled",
      ready: "Ready",
      missing: "Missing",
      current: "Current",
      stale: "Stale",
      available: "Available",
      locked: "Locked",
      running: "Running",
      idle: "Idle",
      unset: "Unset",
      noData: "No data",
      noRecentJob: "No recent job",
      noLogEntries: "No log entries",
      noArtifact: "No artifact",
      inputsAligned: "Inputs and artifact are aligned",
      autoSaveOn: "Settings on this page auto-save to the matching config files.",
      recentLog: "Recent log",
      levelInfo: "Info",
      levelWarn: "Warn",
      levelError: "Error",
      context: "Context",
    },
    pages: {
      scan: {
        title: "Scan",
        description: "Configure the PikPak connection, refresh the source inventory, and resume from saved scan files.",
      },
      folders: {
        title: "Folder Suggestions",
        description: "Generate destination folder suggestions from the category library and manage reusable folders here.",
      },
      classify: {
        title: "Classification",
        description: "Run classification against the latest scan result while keeping model settings, prompts, and short-video rules together.",
      },
      "dry-run": {
        title: "Dry Run",
        description: "Preview the move plan, verify grouping, and confirm everything before any real move happens.",
      },
      move: {
        title: "Move",
        description: "Execute the real move only after classification and preview look correct; this page keeps operational controls isolated.",
      },
      logs: {
        title: "Logs",
        description: "Review the formatted workflow history instead of reading raw JSON or plain-text dumps.",
      },
    },
    status: {
      pending: "Pending",
      running: "Running",
      cancelling: "Cancelling",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    },
    counts: {
      files: (count) => `${count} files`,
      events: (count) => `${count} events`,
    },
  },
};

export function resolveConsoleLocale(
  storedLocale: string | null | undefined,
): ConsoleLocale {
  return SUPPORTED_LOCALES.includes(storedLocale as ConsoleLocale)
    ? (storedLocale as ConsoleLocale)
    : "zh-CN";
}

export function toggleConsoleLocale(locale: ConsoleLocale): ConsoleLocale {
  return locale === "zh-CN" ? "en-US" : "zh-CN";
}

export function getConsoleCopy(locale: ConsoleLocale): ConsoleCopy {
  return COPY[locale];
}

export function formatConsoleTime(
  locale: ConsoleLocale,
  value: string | undefined,
  emptyText: string,
) {
  if (!value) return emptyText;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function getStepTitle(locale: ConsoleLocale, stepId: WorkflowStepId | "logs") {
  return COPY[locale].pages[stepId].title;
}

export function translateJobStatus(
  locale: ConsoleLocale,
  status: JobRecord["status"] | undefined,
) {
  if (!status) return COPY[locale].common.idle;
  return COPY[locale].status[status];
}

