import { useEffect, useRef, useState } from "react";
import type {
  CategoryFolderLibrary,
  ClassificationArtifacts,
  JobLogEntry,
  JobRecord,
  PromptSettings,
  RuntimeSettingsPayload,
  ScanArtifacts,
  WorkflowSummaryResponse,
} from "../../src/types";
import {
  buildApiPath,
  cancelJob,
  fetchCategories,
  fetchClassification,
  fetchFolderSuggestions,
  fetchHealth,
  fetchJob,
  fetchMovePlan,
  fetchPrompts,
  fetchRuntimeSettings,
  fetchScan,
  fetchWorkflowSummary,
  resetPrompts,
  runWorkflowAction,
  saveCategories,
  savePrompts,
  saveRuntimeSettings,
  syncCategories,
  type HealthResponse,
  type WorkflowAction,
} from "./lib/api";
import {
  buildConsolePages,
  getLatestStepJob,
  resolveThemePreference,
  type ConsolePageId,
  type ThemePreference,
} from "./lib/dashboard-view-model";
import {
  addLogToJob,
  EMPTY_CATEGORIES,
  EMPTY_PROMPTS,
  EMPTY_RUNTIME,
  EMPTY_SUMMARY,
  resolvePageFromHash,
  setPageHash,
  sortJobs,
} from "./lib/console-runtime";
import {
  getConsoleCopy,
  resolveConsoleLocale,
  toggleConsoleLocale,
  type ConsoleLocale,
} from "./lib/console-i18n";
import {
  AUTO_SAVE_DELAY_MS,
  getPageAutoSaveScope,
  hasAutoSaveScope,
  LOCALE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "./lib/console-preferences";
import { AppShell } from "./components/app-shell";
import { PageRouter } from "./pages/page-router";

function App() {
  const [theme, setTheme] = useState<ThemePreference>(() =>
    resolveThemePreference(
      typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(THEME_STORAGE_KEY),
      typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
    ),
  );
  const [locale, setLocale] = useState<ConsoleLocale>(() =>
    resolveConsoleLocale(
      typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(LOCALE_STORAGE_KEY),
    ),
  );
  const [activePage, setActivePage] = useState<ConsolePageId>(() =>
    resolvePageFromHash(
      typeof window === "undefined" ? "" : window.location.hash,
    ),
  );
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [runtimeSettings, setRuntimeSettings] =
    useState<RuntimeSettingsPayload>(EMPTY_RUNTIME);
  const [prompts, setPrompts] = useState<PromptSettings>(EMPTY_PROMPTS);
  const [categories, setCategories] =
    useState<CategoryFolderLibrary>(EMPTY_CATEGORIES);
  const [workflowSummary, setWorkflowSummary] =
    useState<WorkflowSummaryResponse>(EMPTY_SUMMARY);
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const latestStateRef = useRef({
    runtimeSettings: EMPTY_RUNTIME,
    prompts: EMPTY_PROMPTS,
    categories: EMPTY_CATEGORIES,
  });
  const autoSaveTimersRef = useRef<
    Partial<Record<Exclude<ConsolePageId, "logs">, number>>
  >({});
  const saveQueueRef = useRef(Promise.resolve());
  const copy = getConsoleCopy(locale);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    latestStateRef.current = { runtimeSettings, prompts, categories };
  }, [runtimeSettings, prompts, categories]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const handleHashChange = () =>
      setActivePage(resolvePageFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) {
      setPageHash("scan");
    }
    void refreshAll();
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      eventSourceRef.current?.close();
      for (const timer of Object.values(autoSaveTimersRef.current)) {
        if (timer) window.clearTimeout(timer);
      }
    };
  }, []);

  async function refreshAll() {
    setIsRefreshing(true);
    setError(null);
    try {
      const [
        nextHealth,
        nextRuntime,
        nextPrompts,
        nextCategories,
        nextScan,
        nextFolders,
        nextClassification,
        nextMovePlan,
        nextSummary,
      ] = await Promise.all([
        fetchHealth(),
        fetchRuntimeSettings(),
        fetchPrompts(),
        fetchCategories(),
        fetchScan(),
        fetchFolderSuggestions(),
        fetchClassification(),
        fetchMovePlan(),
        fetchWorkflowSummary(),
      ]);

      setHealth(nextHealth);
      setRuntimeSettings(nextRuntime);
      setPrompts(nextPrompts);
      setCategories(nextCategories);
      setScan(
        nextScan.files?.length || nextScan.skipped?.length ? nextScan : null,
      );
      setFolderSuggestions(nextFolders.folders?.length ? nextFolders : null);
      setClassification(
        nextClassification.items?.length ? nextClassification : null,
      );
      setMovePlan(nextMovePlan.totalFiles ? nextMovePlan : null);
      setWorkflowSummary(nextSummary);
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

  async function refreshSummaryState() {
    const [nextHealth, nextSummary] = await Promise.all([
      fetchHealth(),
      fetchWorkflowSummary(),
    ]);

    setHealth(nextHealth);
    setWorkflowSummary(nextSummary);
  }

  function clearAutoSave(page: Exclude<ConsolePageId, "logs">) {
    const timer = autoSaveTimersRef.current[page];
    if (!timer) return;
    window.clearTimeout(timer);
    delete autoSaveTimersRef.current[page];
  }

  async function persistSettings(
    page: Exclude<ConsolePageId, "logs">,
    options: {
      refresh: "all" | "summary";
      message?: string;
      trackSaving?: boolean;
    },
  ) {
    const scope = getPageAutoSaveScope(page);
    const current = latestStateRef.current;

    if (!hasAutoSaveScope(scope)) return;

    if (options.trackSaving) {
      setIsSaving(true);
    }

    setError(null);

    try {
      if (scope.runtime) {
        await saveRuntimeSettings(current.runtimeSettings);
      }
      if (scope.prompts) {
        await savePrompts({
          folderSuggestion: current.prompts.folderSuggestion,
          classification: current.prompts.classification,
        });
      }
      if (scope.categories) {
        await saveCategories(
          current.categories.folders.map((folder) => folder.trim()).filter(Boolean),
        );
      }

      if (options.refresh === "all") {
        await refreshAll();
      } else {
        await refreshSummaryState();
      }

      if (options.message) {
        setNotice(options.message);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    } finally {
      if (options.trackSaving) {
        setIsSaving(false);
      }
    }
  }

  function updateRuntimeSection<T extends keyof RuntimeSettingsPayload>(
    page: Exclude<ConsolePageId, "logs">,
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

    scheduleAutoSave(page);
  }

  function scheduleAutoSave(page: Exclude<ConsolePageId, "logs">) {
    const scope = getPageAutoSaveScope(page);

    if (!hasAutoSaveScope(scope)) return;

    clearAutoSave(page);
    autoSaveTimersRef.current[page] = window.setTimeout(() => {
      delete autoSaveTimersRef.current[page];
      saveQueueRef.current = saveQueueRef.current.then(() =>
        persistSettings(page, { refresh: "summary" }),
      );
    }, AUTO_SAVE_DELAY_MS);
  }

  function updateFolderSuggestionPrompt(value: string) {
    setPrompts((current) => ({
      ...current,
      folderSuggestion: value,
    }));
    scheduleAutoSave("folders");
  }

  function updateClassificationPrompt(value: string) {
    setPrompts((current) => ({
      ...current,
      classification: value,
    }));
    scheduleAutoSave("classify");
  }

  function updateCategoryLibrary(value: string) {
    setCategories((current) => ({
      ...current,
      folders: value.split(/\r?\n/),
    }));
    scheduleAutoSave("folders");
  }

  function upsertJob(job: JobRecord) {
    setWorkflowSummary((current) => ({
      ...current,
      jobs: sortJobs([
        job,
        ...current.jobs.filter((entry) => entry.id !== job.id),
      ]),
    }));
  }

  function patchJob(jobId: string, mutate: (job: JobRecord) => JobRecord) {
    setWorkflowSummary((current) => ({
      ...current,
      jobs: sortJobs(
        current.jobs.map((job) => (job.id === jobId ? mutate(job) : job)),
      ),
    }));
  }

  function connectJobStream(jobId: string) {
    eventSourceRef.current?.close();
    const source = new EventSource(buildApiPath(`/api/jobs/${jobId}/stream`));
    eventSourceRef.current = source;

    source.onmessage = async (event) => {
      const payload = JSON.parse(event.data) as {
        type: "snapshot" | "status" | "log" | "result" | "heartbeat";
        payload: unknown;
      };

      if (payload.type === "snapshot") {
        upsertJob(payload.payload as JobRecord);
        return;
      }

      if (payload.type === "status") {
        const status = (payload.payload as { status: JobRecord["status"] })
          .status;
        patchJob(jobId, (job) => ({
          ...job,
          status,
          updatedAt: new Date().toISOString(),
        }));
        if (
          status === "completed" ||
          status === "failed" ||
          status === "cancelled"
        ) {
          const snapshot = await fetchJob(jobId);
          upsertJob(snapshot);
          await refreshAll();
          source.close();
        }
        return;
      }

      if (payload.type === "log") {
        const logPayload = payload.payload as {
          message: string;
          entry?: JobLogEntry;
        };
        patchJob(jobId, (job) =>
          addLogToJob(job, logPayload.message, logPayload.entry),
        );
        return;
      }

      if (payload.type === "result") {
        patchJob(jobId, (job) => ({
          ...job,
          result: payload.payload,
          updatedAt: new Date().toISOString(),
        }));
      }
    };
  }

  async function saveCurrentPageSettings(
    page: Exclude<ConsolePageId, "logs">,
    message: string,
  ) {
    clearAutoSave(page);
    await persistSettings(page, {
      refresh: "all",
      message,
      trackSaving: true,
    });
  }

  async function runAction(action: WorkflowAction) {
    if (action === "move") {
      const confirmed = window.confirm(
        locale === "zh-CN"
          ? "这会在 PikPak 中真实移动文件，是否继续？"
          : "This will move files in PikPak. Continue?",
      );
      if (!confirmed) return;
    }

    setError(null);
    try {
      const response = await runWorkflowAction(action);
      connectJobStream(response.jobId);
      setNotice(
        locale === "zh-CN"
          ? `${copy.pages[action].title}已启动`
          : `${copy.pages[action].title} started`,
      );
      const snapshot = await fetchJob(response.jobId);
      upsertJob(snapshot);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    }
  }

  async function stopJobForPage(page: Exclude<ConsolePageId, "logs">) {
    const latestJob = getLatestStepJob(page, workflowSummary.jobs);
    if (
      !latestJob ||
      latestJob.status === "completed" ||
      latestJob.status === "failed" ||
      latestJob.status === "cancelled"
    ) {
      return;
    }

    try {
      const response = await cancelJob(latestJob.id);
      upsertJob(response.job);
      setNotice(
        locale === "zh-CN"
          ? `已请求停止${copy.pages[page].title}`
          : `Stop requested for ${copy.pages[page].title}`,
      );
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : String(cancelError),
      );
    }
  }

  async function syncCategoriesNow() {
    setIsSaving(true);
    setError(null);
    try {
      const next = await syncCategories();
      setCategories(next);
      await refreshAll();
      setNotice(
        locale === "zh-CN"
          ? "已从目标目录同步分类库"
          : "Category library synced from target folders",
      );
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : String(syncError),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function resetPromptTexts() {
    setIsSaving(true);
    setError(null);
    try {
      const next = await resetPrompts();
      setPrompts(next);
      await refreshAll();
      setNotice(
        locale === "zh-CN"
          ? "提示词已重置为默认值"
          : "Prompts reset to defaults",
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error ? resetError.message : String(resetError),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const pages = buildConsolePages(workflowSummary, locale);
  const scanJob = getLatestStepJob("scan", workflowSummary.jobs);
  const foldersJob = getLatestStepJob("folders", workflowSummary.jobs);
  const classifyJob = getLatestStepJob("classify", workflowSummary.jobs);
  const dryRunJob = getLatestStepJob("dry-run", workflowSummary.jobs);
  const moveJob = getLatestStepJob("move", workflowSummary.jobs);

  return (
    <AppShell
      activePage={activePage}
      locale={locale}
      onSelectPage={(page) => {
        setActivePage(page);
        setPageHash(page);
      }}
      onToggleLocale={() => setLocale((current) => toggleConsoleLocale(current))}
      onToggleTheme={() =>
        setTheme((current) => (current === "dark" ? "light" : "dark"))
      }
      pages={pages}
      theme={theme}
    >
      {error ? <div className="banner banner-error">{error}</div> : null}
      {notice ? <div className="banner banner-notice">{notice}</div> : null}
      <PageRouter
        activePage={activePage}
        categories={categories}
        classification={classification}
        folderSuggestions={folderSuggestions}
        health={health}
        isRefreshing={isRefreshing}
        isSaving={isSaving}
        locale={locale}
        jobs={{
          scan: scanJob,
          folders: foldersJob,
          classify: classifyJob,
          "dry-run": dryRunJob,
          move: moveJob,
          all: workflowSummary.jobs,
        }}
        movePlan={movePlan}
        onRefresh={() => void refreshAll()}
        onResetPrompts={() => void resetPromptTexts()}
        onRun={(action) => void runAction(action)}
        onSaveClassification={() =>
          void saveCurrentPageSettings(
            "classify",
            locale === "zh-CN"
              ? "分类页设置已保存"
              : "Classification settings saved",
          )
        }
        onSaveDryRun={() =>
          void saveCurrentPageSettings(
            "dry-run",
            locale === "zh-CN" ? "预演设置已保存" : "Dry run settings saved",
          )
        }
        onSaveFolders={() =>
          void saveCurrentPageSettings(
            "folders",
            locale === "zh-CN"
              ? "文件夹建议页设置已保存"
              : "Folder suggestion settings saved",
          )
        }
        onSaveMove={() =>
          void saveCurrentPageSettings(
            "move",
            locale === "zh-CN" ? "移动设置已保存" : "Move settings saved",
          )
        }
        onSaveScan={() =>
          void saveCurrentPageSettings(
            "scan",
            locale === "zh-CN" ? "扫描设置已保存" : "Scan settings saved",
          )
        }
        onStop={(page) => void stopJobForPage(page)}
        onSyncCategories={() => void syncCategoriesNow()}
        onUpdateCategoryLibrary={updateCategoryLibrary}
        onUpdateClassificationPrompt={updateClassificationPrompt}
        onUpdateFolderSuggestionPrompt={updateFolderSuggestionPrompt}
        prompts={prompts}
        runtimeSettings={runtimeSettings}
        scan={scan}
        summaries={{
          scan: workflowSummary.steps.scan,
          folders: workflowSummary.steps.folders,
          classify: workflowSummary.steps.classify,
          "dry-run": workflowSummary.steps["dry-run"],
          move: workflowSummary.steps.move,
          logs: undefined,
        }}
        updateRuntimeSection={updateRuntimeSection}
      />
    </AppShell>
  );
}

export default App;
