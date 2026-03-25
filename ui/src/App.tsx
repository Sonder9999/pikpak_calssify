import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CategoryFolderLibrary,
  ClassificationArtifacts,
  JobRecord,
  PromptSettings,
  RuntimeSettingsPayload,
  ScanArtifacts,
} from "../../src/types";
import {
  cancelJob,
  fetchCategories,
  fetchClassification,
  fetchConfigSummary,
  fetchFolderSuggestions,
  fetchHealth,
  fetchJob,
  fetchMovePlan,
  fetchPrompts,
  fetchRuntimeSettings,
  fetchScan,
  resetPrompts,
  runWorkflowAction,
  saveCategories,
  savePrompts,
  saveRuntimeSettings,
  syncCategories,
  type HealthResponse,
  type WorkflowAction,
  type WorkflowConfigSummary,
} from "./lib/api";
import {
  buildWorkflowSteps,
  resolveThemePreference,
  type ThemePreference,
  type WorkflowStepModel,
} from "./lib/dashboard-view-model";

const THEME_KEY = "pikpak-dashboard-theme";

const EMPTY_RUNTIME: RuntimeSettingsPayload = {
  network: { proxyUrl: "" },
  pikpak: {
    username: "",
    password: "",
    sourceFolder: "",
    targetFolder: "",
    deviceId: "",
  },
  llm: {
    apiKey: "",
    baseUrl: "",
    model: "",
  },
  workflow: {
    outputDir: "output",
    batchSize: 20,
    onlyClassifyVideo: false,
    enableShortVideoFilter: false,
    shortVideoThresholdSeconds: 120,
    moveBatchSize: 10,
    moveMinDelayMs: 300,
    moveMaxDelayMs: 800,
  },
};

const EMPTY_PROMPTS: PromptSettings = {
  folderSuggestion: "",
  classification: "",
  updatedAt: "",
};

const EMPTY_CATEGORIES: CategoryFolderLibrary = {
  folders: [],
  updatedAt: "",
};

const sectionIds: Record<WorkflowAction, string> = {
  scan: "step-scan",
  folders: "step-folders",
  classify: "step-classify",
  "dry-run": "step-dry-run",
  move: "step-move",
};

const actionLabels: Record<WorkflowAction, string> = {
  scan: "开始扫描",
  folders: "生成目录建议",
  classify: "执行分类",
  "dry-run": "预演移动",
  move: "正式移动",
};

function isTerminalStatus(status?: JobRecord["status"]) {
  return (
    status === "completed" || status === "failed" || status === "cancelled"
  );
}

function statusTone(status: WorkflowStepModel["status"]) {
  switch (status) {
    case "completed":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
    case "running":
      return "border-sky-400/30 bg-sky-500/10 text-sky-300";
    case "failed":
      return "border-rose-400/30 bg-rose-500/10 text-rose-300";
    case "actionable":
      return "border-violet-400/30 bg-violet-500/10 text-violet-300";
    default:
      return "border-slate-400/20 bg-slate-500/10 text-[var(--text-soft)]";
  }
}

function formatTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function countFolders(classification?: ClassificationArtifacts | null) {
  return new Set(classification?.items.map((item) => item.folder) ?? []).size;
}

function App() {
  const [theme, setTheme] = useState<ThemePreference>(() =>
    resolveThemePreference(
      typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(THEME_KEY),
      typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
    ),
  );
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [configSummary, setConfigSummary] =
    useState<WorkflowConfigSummary | null>(null);
  const [runtimeSettings, setRuntimeSettings] =
    useState<RuntimeSettingsPayload>(EMPTY_RUNTIME);
  const [prompts, setPrompts] = useState<PromptSettings>(EMPTY_PROMPTS);
  const [categories, setCategories] =
    useState<CategoryFolderLibrary>(EMPTY_CATEGORIES);
  const [scan, setScan] = useState<ScanArtifacts | null>(null);
  const [folderSuggestions, setFolderSuggestions] = useState<{
    folders: string[];
    createdAt?: string;
  } | null>(null);
  const [classification, setClassification] =
    useState<ClassificationArtifacts | null>(null);
  const [movePlan, setMovePlan] = useState<{
    groups: Array<{
      folder: string;
      files: Array<{ name: string; path: string }>;
    }>;
    totalFiles: number;
    createdAt?: string;
  } | null>(null);
  const [currentJob, setCurrentJob] = useState<JobRecord | null>(null);
  const [currentMoveMode, setCurrentMoveMode] = useState<
    "dry-run" | "move" | null
  >(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    void refreshAll();
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  async function refreshWorkflowArtifacts() {
    const [nextScan, nextFolders, nextClassification, nextPlan] =
      await Promise.all([
        fetchScan(),
        fetchFolderSuggestions(),
        fetchClassification(),
        fetchMovePlan(),
      ]);
    setScan(
      nextScan.files?.length || nextScan.skipped?.length ? nextScan : null,
    );
    setFolderSuggestions(nextFolders.folders?.length ? nextFolders : null);
    setClassification(
      nextClassification.items?.length ? nextClassification : null,
    );
    setMovePlan(nextPlan.totalFiles ? nextPlan : null);
  }

  async function refreshSettingsAndSummary() {
    const [nextHealth, nextConfig, nextRuntime, nextPrompts, nextCategories] =
      await Promise.all([
        fetchHealth(),
        fetchConfigSummary(),
        fetchRuntimeSettings(),
        fetchPrompts(),
        fetchCategories(),
      ]);
    setHealth(nextHealth);
    setConfigSummary(nextConfig);
    setRuntimeSettings(nextRuntime);
    setPrompts(nextPrompts);
    setCategories(nextCategories);
  }

  async function refreshAll() {
    setIsRefreshing(true);
    setError(null);
    try {
      await Promise.all([
        refreshSettingsAndSummary(),
        refreshWorkflowArtifacts(),
      ]);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : String(refreshError),
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function updateRuntimeSection<T extends keyof RuntimeSettingsPayload>(
    section: T,
    field: keyof RuntimeSettingsPayload[T],
    value: RuntimeSettingsPayload[T][keyof RuntimeSettingsPayload[T]],
  ) {
    setRuntimeSettings((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  function connectJobStream(
    jobId: string,
    moveMode: "dry-run" | "move" | null,
  ) {
    eventSourceRef.current?.close();
    const source = new EventSource(`/api/jobs/${jobId}/stream`);
    eventSourceRef.current = source;

    source.onmessage = async (event) => {
      const payload = JSON.parse(event.data) as {
        type: "snapshot" | "status" | "log" | "result" | "heartbeat";
        payload: unknown;
      };

      if (payload.type === "snapshot") {
        setCurrentJob(payload.payload as JobRecord);
        return;
      }

      if (payload.type === "status") {
        const status = (payload.payload as { status: JobRecord["status"] })
          .status;
        setCurrentJob((current) =>
          current
            ? { ...current, status, updatedAt: new Date().toISOString() }
            : current,
        );
        if (isTerminalStatus(status)) {
          const snapshot = await fetchJob(jobId);
          setCurrentJob(snapshot);
          setCurrentMoveMode(moveMode);
          await refreshWorkflowArtifacts();
          source.close();
        }
        return;
      }

      if (payload.type === "log") {
        const message = (payload.payload as { message: string }).message;
        setCurrentJob((current) =>
          current
            ? {
                ...current,
                logs: [...current.logs, message],
                updatedAt: new Date().toISOString(),
              }
            : current,
        );
        return;
      }

      if (payload.type === "result") {
        setCurrentJob((current) =>
          current
            ? {
                ...current,
                result: payload.payload,
                updatedAt: new Date().toISOString(),
              }
            : current,
        );
      }
    };
  }

  async function runAction(action: WorkflowAction) {
    if (action === "move") {
      const confirmed = window.confirm(
        "正式移动会修改 PikPak 中的文件位置，确定继续吗？",
      );
      if (!confirmed) return;
    }

    setError(null);
    try {
      const response = await runWorkflowAction(action);
      const moveMode =
        action === "move" ? "move" : action === "dry-run" ? "dry-run" : null;
      setCurrentMoveMode(moveMode);
      connectJobStream(response.jobId, moveMode);
      setNotice(`${actionLabels[action]}已开始`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    }
  }

  async function stopCurrentJob() {
    if (!currentJob?.id || isTerminalStatus(currentJob.status)) return;
    try {
      const response = await cancelJob(currentJob.id);
      setCurrentJob(response.job);
      setNotice("已发送停止请求");
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : String(cancelError),
      );
    }
  }

  async function onSaveRuntime() {
    setIsSaving(true);
    setError(null);
    try {
      await saveRuntimeSettings(runtimeSettings);
      await refreshSettingsAndSummary();
      setNotice("运行配置已保存");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function onSavePrompts() {
    setIsSaving(true);
    setError(null);
    try {
      const next = await savePrompts({
        folderSuggestion: prompts.folderSuggestion,
        classification: prompts.classification,
      });
      setPrompts(next);
      setNotice("Prompt 已保存");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function onResetPrompts() {
    setIsSaving(true);
    setError(null);
    try {
      const next = await resetPrompts();
      setPrompts(next);
      setNotice("Prompt 已恢复默认");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function onSaveCategories() {
    setIsSaving(true);
    setError(null);
    try {
      const next = await saveCategories(
        categories.folders.map((folder) => folder.trim()).filter(Boolean),
      );
      setCategories(next);
      setNotice("分类目录已保存");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function onSyncCategories() {
    setIsSaving(true);
    setError(null);
    try {
      const next = await syncCategories();
      setCategories(next);
      setNotice("已同步目标目录中的现有分类文件夹");
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : String(syncError),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const steps = useMemo(
    () =>
      buildWorkflowSteps({
        scan,
        folderSuggestions,
        classification,
        movePlan,
        currentJob,
        currentMoveMode,
      }),
    [
      classification,
      currentJob,
      currentMoveMode,
      folderSuggestions,
      movePlan,
      scan,
    ],
  );

  const proxyEnabled = Boolean(configSummary?.network?.proxyUrl);
  const currentTaskRunning = Boolean(
    currentJob && !isTerminalStatus(currentJob.status),
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-5 text-[var(--text)] sm:px-6 lg:px-8 lg:py-8">
      <header className="glass-panel-strong relative overflow-hidden rounded-[2rem] px-6 py-6 sm:px-8 sm:py-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_60%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              PikPak Step Flow Console
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                现代化单页流程工作台
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">
                从扫描到移动，整套分类流程按步骤完整展开；你只需要沿着页面一路往下，就能完成一次完整的
                PikPak 整理工作。
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <button
                className="button-base secondary-button"
                onClick={() =>
                  setTheme((current) => (current === "dark" ? "light" : "dark"))
                }
                type="button"
              >
                {theme === "dark" ? "切换浅色" : "切换深色"}
              </button>
              <button
                className="button-base secondary-button"
                onClick={() => void refreshAll()}
                type="button"
              >
                {isRefreshing ? "刷新中..." : "刷新数据"}
              </button>
              <button
                className="button-base secondary-button"
                disabled={
                  !currentTaskRunning || currentJob?.status === "cancelling"
                }
                onClick={() => void stopCurrentJob()}
                type="button"
              >
                {currentJob?.status === "cancelling"
                  ? "停止中..."
                  : "停止当前任务"}
              </button>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
              <StatusBox
                label="代理状态"
                value={proxyEnabled ? "已启用" : "未启用"}
                hint={configSummary?.network?.proxyUrl || "未配置代理地址"}
              />
              <StatusBox
                label="配置校验"
                value={health?.config.valid ? "通过" : "需处理"}
                hint={
                  health?.config.valid
                    ? "运行配置已准备就绪"
                    : health?.config.errors.join("；") || "存在缺失项"
                }
              />
              <StatusBox
                label="当前任务"
                value={currentJob ? currentJob.type : "空闲"}
                hint={
                  currentJob
                    ? `${currentJob.status} · ${formatTime(currentJob.updatedAt)}`
                    : "等待你开始下一步"
                }
              />
            </div>
          </div>
        </div>
      </header>

      <nav className="glass-panel sticky top-4 z-30 rounded-[1.5rem] px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {steps.map((step) => (
            <button
              key={step.id}
              className={`button-base ${step.status === "running" || step.status === "completed" ? "primary-button" : "secondary-button"} px-4 py-3 text-sm`}
              onClick={() =>
                document
                  .getElementById(sectionIds[step.id])
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              type="button"
            >
              <span className="text-xs uppercase tracking-[0.2em] opacity-75">
                {String(step.index).padStart(2, "0")}
              </span>
              <span>{step.title}</span>
            </button>
          ))}
        </div>
      </nav>

      {error ? (
        <div className="glass-panel rounded-3xl border border-rose-400/25 px-5 py-4 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="glass-panel rounded-3xl border border-emerald-400/20 px-5 py-4 text-sm text-emerald-300">
          {notice}
        </div>
      ) : null}

      <main className="space-y-5 pb-10">
        <StepCard
          actionLabel={actionLabels.scan}
          description="连接 PikPak、扫描源目录，并生成本次流程的基础文件列表。"
          id={sectionIds.scan}
          onAction={() => void runAction("scan")}
          status={steps[0]}
        >
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <MetricGrid
              metrics={[
                { label: "可分类文件", value: String(scan?.files.length ?? 0) },
                { label: "跳过文件", value: String(scan?.skipped.length ?? 0) },
                { label: "最近更新时间", value: formatTime(scan?.createdAt) },
              ]}
            />
            <ListPanel
              emptyText="扫描完成后，这里会展示本次文件采样。"
              items={(scan?.files ?? [])
                .slice(0, 6)
                .map((file) => `${file.name} · ${file.path}`)}
              title="文件采样"
            />
          </div>
        </StepCard>

        <StepCard
          actionLabel={actionLabels.folders}
          description="根据扫描结果和现有目录，生成可直接复用的分类建议。"
          disabled={!scan}
          id={sectionIds.folders}
          onAction={() => void runAction("folders")}
          status={steps[1]}
        >
          <div className="space-y-4">
            <MetricGrid
              metrics={[
                {
                  label: "建议目录数",
                  value: String(folderSuggestions?.folders.length ?? 0),
                },
                {
                  label: "当前分类库",
                  value: String(categories.folders.length),
                },
                {
                  label: "最近更新时间",
                  value: formatTime(folderSuggestions?.createdAt),
                },
              ]}
            />
            <ChipPanel
              emptyText="生成目录建议后，这里会展示可直接使用的分类目录。"
              items={folderSuggestions?.folders ?? []}
              title="目录建议"
            />
          </div>
        </StepCard>

        <StepCard
          actionLabel={actionLabels.classify}
          description="使用当前 Prompt 和目录集合生成分类结果，并自动形成移动计划。"
          disabled={!scan}
          id={sectionIds.classify}
          onAction={() => void runAction("classify")}
          status={steps[2]}
        >
          <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
            <MetricGrid
              metrics={[
                {
                  label: "分类文件数",
                  value: String(classification?.items.length ?? 0),
                },
                {
                  label: "目标文件夹",
                  value: String(countFolders(classification)),
                },
                {
                  label: "最近更新时间",
                  value: formatTime(classification?.createdAt),
                },
              ]}
            />
            <TablePanel
              columns={["文件", "路径", "分类"]}
              emptyText="执行分类后，这里会出现分类结果。"
              rows={(classification?.items ?? [])
                .slice(0, 8)
                .map((item) => [item.name, item.path, item.folder])}
              title="分类结果"
            />
          </div>
        </StepCard>

        <StepCard
          actionLabel={actionLabels["dry-run"]}
          description="先执行 Dry Run，确认计划移动的文件和目标目录，再决定是否正式移动。"
          disabled={!classification}
          id={sectionIds["dry-run"]}
          onAction={() => void runAction("dry-run")}
          status={steps[3]}
        >
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <MetricGrid
              metrics={[
                {
                  label: "计划移动文件",
                  value: String(movePlan?.totalFiles ?? 0),
                },
                {
                  label: "目标分组",
                  value: String(movePlan?.groups.length ?? 0),
                },
                {
                  label: "计划生成时间",
                  value: formatTime(movePlan?.createdAt),
                },
              ]}
            />
            <ListPanel
              emptyText="执行 Dry Run 后，这里会展示移动计划。"
              items={(movePlan?.groups ?? [])
                .slice(0, 6)
                .map(
                  (group) => `${group.folder} · ${group.files.length} 个文件`,
                )}
              title="移动计划预览"
            />
          </div>
        </StepCard>

        <StepCard
          actionLabel={actionLabels.move}
          description="确认无误后执行最终移动。为了安全，这一步会二次确认。"
          disabled={!movePlan}
          id={sectionIds.move}
          onAction={() => void runAction("move")}
          status={steps[4]}
        >
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <ListPanel
              emptyText="完成 Dry Run 后，这里会显示正式移动前的注意事项。"
              items={[
                `本次计划移动 ${movePlan?.totalFiles ?? 0} 个文件`,
                `将写入 ${movePlan?.groups.length ?? 0} 个目标文件夹`,
                "建议先完成 Dry Run，再执行正式移动",
              ]}
              title="执行提醒"
            />
            <ListPanel
              emptyText="正式移动完成后，这里会保留结果摘要。"
              items={
                currentJob?.type === "move" && currentMoveMode === "move"
                  ? [
                      `状态：${currentJob.status}`,
                      `更新时间：${formatTime(currentJob.updatedAt)}`,
                      ...(currentJob.result &&
                      typeof currentJob.result === "object"
                        ? Object.entries(
                            currentJob.result as Record<string, unknown>,
                          ).map(([key, value]) => `${key}: ${String(value)}`)
                        : []),
                    ]
                  : []
              }
              title="移动结果"
            />
          </div>
        </StepCard>

        <section className="glass-panel-strong rounded-[2rem] p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
                Global Log
              </p>
              <h2 className="text-2xl font-semibold">实时日志与任务状态</h2>
            </div>
            <div
              className={`rounded-full border px-4 py-2 text-sm font-medium ${statusTone(currentJob && !isTerminalStatus(currentJob.status) ? "running" : currentJob?.status === "failed" ? "failed" : currentJob ? "completed" : "locked")}`}
            >
              {currentJob
                ? `${currentJob.type} · ${currentJob.status}`
                : "当前没有正在跟踪的任务"}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <MetricGrid
              metrics={[
                { label: "当前任务", value: currentJob?.type ?? "空闲" },
                { label: "状态", value: currentJob?.status ?? "idle" },
                { label: "最后更新", value: formatTime(currentJob?.updatedAt) },
              ]}
            />
            <div className="rounded-[1.5rem] border border-white/10 bg-[var(--surface-muted)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">日志流</h3>
                <span className="text-xs text-[var(--text-muted)]">
                  仅显示当前跟踪任务
                </span>
              </div>
              <pre className="max-h-80 overflow-auto rounded-2xl border border-white/8 bg-[#020617]/80 p-4 text-sm leading-7 text-slate-200">
                {(currentJob?.logs ?? ["等待任务开始..."]).join("\n")}
              </pre>
            </div>
          </div>
        </section>

        <section className="glass-panel-strong rounded-[2rem] p-5 sm:p-6">
          <div className="mb-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
              Advanced Settings
            </p>
            <h2 className="text-2xl font-semibold">高级设置与维护区</h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--text-soft)]">
              这些设置不会打断主流程，但仍然保留在同一页面底部，方便你在需要时调整运行参数、Prompt
              和分类目录。
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-[var(--surface-muted)] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">运行配置</h3>
                <button
                  className="button-base primary-button"
                  disabled={isSaving}
                  onClick={() => void onSaveRuntime()}
                  type="button"
                >
                  保存运行配置
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="账号">
                  <input
                    className="field-input"
                    value={runtimeSettings.pikpak.username}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "pikpak",
                        "username",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="密码">
                  <input
                    className="field-input"
                    type="password"
                    value={runtimeSettings.pikpak.password}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "pikpak",
                        "password",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="源目录">
                  <input
                    className="field-input"
                    value={runtimeSettings.pikpak.sourceFolder}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "pikpak",
                        "sourceFolder",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="目标目录">
                  <input
                    className="field-input"
                    value={runtimeSettings.pikpak.targetFolder}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "pikpak",
                        "targetFolder",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="设备 ID">
                  <input
                    className="field-input"
                    value={runtimeSettings.pikpak.deviceId ?? ""}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "pikpak",
                        "deviceId",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="代理 URL">
                  <input
                    className="field-input"
                    value={runtimeSettings.network.proxyUrl ?? ""}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "network",
                        "proxyUrl",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="LLM API Key">
                  <input
                    className="field-input"
                    type="password"
                    value={runtimeSettings.llm.apiKey}
                    onChange={(event) =>
                      updateRuntimeSection("llm", "apiKey", event.target.value)
                    }
                  />
                </Field>
                <Field label="LLM Base URL">
                  <input
                    className="field-input"
                    value={runtimeSettings.llm.baseUrl}
                    onChange={(event) =>
                      updateRuntimeSection("llm", "baseUrl", event.target.value)
                    }
                  />
                </Field>
                <Field label="LLM Model">
                  <input
                    className="field-input"
                    value={runtimeSettings.llm.model}
                    onChange={(event) =>
                      updateRuntimeSection("llm", "model", event.target.value)
                    }
                  />
                </Field>
                <Field label="输出目录">
                  <input
                    className="field-input"
                    value={runtimeSettings.workflow.outputDir}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "workflow",
                        "outputDir",
                        event.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="分类批大小">
                  <input
                    className="field-input"
                    type="number"
                    value={runtimeSettings.workflow.batchSize}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "workflow",
                        "batchSize",
                        Number(event.target.value),
                      )
                    }
                  />
                </Field>
                <Field label="移动批大小">
                  <input
                    className="field-input"
                    type="number"
                    value={runtimeSettings.workflow.moveBatchSize}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "workflow",
                        "moveBatchSize",
                        Number(event.target.value),
                      )
                    }
                  />
                </Field>
                <Field label="短视频阈值(秒)">
                  <input
                    className="field-input"
                    type="number"
                    value={runtimeSettings.workflow.shortVideoThresholdSeconds}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "workflow",
                        "shortVideoThresholdSeconds",
                        Number(event.target.value),
                      )
                    }
                  />
                </Field>
                <Field label="最小延迟(ms)">
                  <input
                    className="field-input"
                    type="number"
                    value={runtimeSettings.workflow.moveMinDelayMs}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "workflow",
                        "moveMinDelayMs",
                        Number(event.target.value),
                      )
                    }
                  />
                </Field>
                <Field label="最大延迟(ms)">
                  <input
                    className="field-input"
                    type="number"
                    value={runtimeSettings.workflow.moveMaxDelayMs}
                    onChange={(event) =>
                      updateRuntimeSection(
                        "workflow",
                        "moveMaxDelayMs",
                        Number(event.target.value),
                      )
                    }
                  />
                </Field>
                <ToggleField
                  label="只分类视频"
                  checked={runtimeSettings.workflow.onlyClassifyVideo}
                  onChange={(checked) =>
                    updateRuntimeSection(
                      "workflow",
                      "onlyClassifyVideo",
                      checked,
                    )
                  }
                />
                <ToggleField
                  label="启用短视频过滤"
                  checked={runtimeSettings.workflow.enableShortVideoFilter}
                  onChange={(checked) =>
                    updateRuntimeSection(
                      "workflow",
                      "enableShortVideoFilter",
                      checked,
                    )
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="rounded-[1.5rem] border border-white/10 bg-[var(--surface-muted)] p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Prompt</h3>
                  <div className="flex gap-3">
                    <button
                      className="button-base secondary-button"
                      disabled={isSaving}
                      onClick={() => void onResetPrompts()}
                      type="button"
                    >
                      恢复默认
                    </button>
                    <button
                      className="button-base primary-button"
                      disabled={isSaving}
                      onClick={() => void onSavePrompts()}
                      type="button"
                    >
                      保存 Prompt
                    </button>
                  </div>
                </div>
                <div className="grid gap-4">
                  <Field label="目录建议 Prompt">
                    <textarea
                      className="field-input min-h-36"
                      value={prompts.folderSuggestion}
                      onChange={(event) =>
                        setPrompts((current) => ({
                          ...current,
                          folderSuggestion: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="分类 Prompt">
                    <textarea
                      className="field-input min-h-36"
                      value={prompts.classification}
                      onChange={(event) =>
                        setPrompts((current) => ({
                          ...current,
                          classification: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-[var(--surface-muted)] p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">分类目录</h3>
                  <div className="flex gap-3">
                    <button
                      className="button-base secondary-button"
                      disabled={isSaving}
                      onClick={() => void onSyncCategories()}
                      type="button"
                    >
                      同步已有目录
                    </button>
                    <button
                      className="button-base primary-button"
                      disabled={isSaving}
                      onClick={() => void onSaveCategories()}
                      type="button"
                    >
                      保存分类目录
                    </button>
                  </div>
                </div>
                <Field label="每行一个分类目录">
                  <textarea
                    className="field-input min-h-44"
                    value={categories.folders.join("\n")}
                    onChange={(event) =>
                      setCategories((current) => ({
                        ...current,
                        folders: event.target.value.split(/\r?\n/),
                      }))
                    }
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[var(--surface-muted)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">配置摘要</h3>
              <span className="text-xs text-[var(--text-muted)]">
                用于快速确认当前运行环境
              </span>
            </div>
            <pre className="overflow-auto rounded-2xl border border-white/8 bg-[#020617]/80 p-4 text-sm leading-7 text-slate-200">
              {JSON.stringify(configSummary, null, 2)}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}

function StepCard({
  id,
  status,
  description,
  actionLabel,
  onAction,
  disabled,
  children,
}: {
  id: string;
  status: WorkflowStepModel;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel-strong rounded-[2rem] p-5 sm:p-6" id={id}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="inline-flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Step {String(status.index).padStart(2, "0")}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-sm font-medium ${statusTone(status.status)}`}
            >
              {status.status}
            </span>
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="text-2xl font-semibold sm:text-[1.85rem]">
              {status.title}
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--text-soft)]">
              {description}
            </p>
            <p
              className="max-w-full overflow-hidden break-words text-sm text-[var(--text-muted)]"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
              }}
              title={status.summary}
            >
              {status.summary}
            </p>
          </div>
        </div>
        <button
          className="button-base primary-button shrink-0"
          disabled={disabled}
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

function StatusBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-[var(--surface-muted)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{hint}</p>
    </div>
  );
}

function MetricGrid({
  metrics,
}: {
  metrics: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-[1.35rem] border border-white/10 bg-[var(--surface-muted)] p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            {metric.label}
          </p>
          <p className="mt-4 text-2xl font-semibold">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

function ListPanel({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[var(--surface-muted)] p-4">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {items.length > 0 ? (
        <ul className="space-y-3 text-sm leading-7 text-[var(--text-soft)]">
          {items.map((item) => (
            <li key={item} className="surface-chip rounded-2xl px-4 py-3">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-7 text-[var(--text-muted)]">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function ChipPanel({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[var(--surface-muted)] p-4">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {items.map((item) => (
            <span
              key={item}
              className="surface-chip rounded-full px-4 py-2 text-sm text-[var(--text-soft)]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-7 text-[var(--text-muted)]">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function TablePanel({
  title,
  columns,
  rows,
  emptyText,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  emptyText: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[var(--surface-muted)] p-4">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {rows.length > 0 ? (
        <div className="overflow-auto rounded-2xl border border-white/8">
          <table className="min-w-full text-left text-sm text-[var(--text-soft)]">
            <thead className="bg-black/10 text-[var(--text)]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.join("|")} className="border-t border-white/8">
                  {row.map((cell) => (
                    <td key={cell} className="px-4 py-3 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm leading-7 text-[var(--text-muted)]">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2 text-sm text-[var(--text-soft)]">
      <span className="font-medium text-[var(--text)]">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 py-4 text-sm text-[var(--text)]">
      <span>{label}</span>
      <button
        className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-gradient-to-r from-cyan-400 to-indigo-500" : "bg-slate-400/30"}`}
        onClick={(event) => {
          event.preventDefault();
          onChange(!checked);
        }}
        type="button"
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`}
        />
      </button>
    </label>
  );
}

export default App;
