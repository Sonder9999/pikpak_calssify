const configPanel = document.getElementById("configPanel");
const logPanel = document.getElementById("logPanel");
const planPanel = document.getElementById("planPanel");
const classificationTable = document.getElementById("classificationTable");
const jobStatus = document.getElementById("jobStatus");
const progressPanel = document.getElementById("progressPanel");
const proxyStatusBadge = document.getElementById("proxyStatusBadge");
const proxyStatusText = document.getElementById("proxyStatusText");
const proxyStatusMeta = document.getElementById("proxyStatusMeta");
const runtimeForm = document.getElementById("runtimeForm");
const folderPrompt = document.getElementById("folderPrompt");
const classificationPrompt = document.getElementById("classificationPrompt");
const categoryFolders = document.getElementById("categoryFolders");

let currentEventSource = null;
let currentJobState = null;

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "请求失败");
  }
  return response.json();
}

function notify(message) {
  window.alert(message);
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[char],
  );
}

function applyBadgeState(element, state) {
  element.classList.remove(
    "status-active",
    "status-idle",
    "status-warn",
    "status-error",
  );
  element.classList.add(state);
}

function findLastMatch(logs, pattern) {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const match = logs[index].match(pattern);
    if (match) return match;
  }
  return null;
}

function renderProgress(details) {
  if (!details || !details.items?.length) {
    progressPanel.textContent = details?.summary || "等待任务开始";
    return;
  }

  progressPanel.innerHTML = `
    <div class="progress-summary">${escapeHtml(details.summary)}</div>
    <div class="progress-grid">
      ${details.items
        .map(
          (item) => `
            <div class="progress-item">
              <span class="progress-label">${escapeHtml(item.label)}</span>
              <span class="progress-value">${escapeHtml(item.value)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function deriveJobProgress(job) {
  if (!job) return { summary: "等待任务开始", items: [] };

  const logs = job.logs || [];
  const latestLog = logs.at(-1) || "暂无日志";

  if (job.type === "classify") {
    const start = findLastMatch(
      logs,
      /开始分类：LLM 处理 (\d+) 个，短视频直归 (\d+) 个/,
    );
    const batches = findLastMatch(
      logs,
      /分类将分 (\d+) 批执行，每批最多 (\d+) 个文件/,
    );
    const progress = findLastMatch(
      logs,
      /分类进度：第 (\d+)\/(\d+) 批已完成，累计 (\d+)\/(\d+)/,
    );

    return {
      summary:
        job.status === "failed"
          ? `分类失败：${job.error || latestLog}`
          : job.status === "completed"
            ? "分类已完成"
            : latestLog,
      items: [
        {
          label: "任务状态",
          value: job.status,
        },
        {
          label: "LLM 文件数",
          value: start ? start[1] : "-",
        },
        {
          label: "短视频直归",
          value: start ? start[2] : "-",
        },
        {
          label: "批次进度",
          value: progress ? `${progress[1]}/${progress[2]}` : batches ? `0/${batches[1]}` : "-",
        },
        {
          label: "文件进度",
          value: progress ? `${progress[3]}/${progress[4]}` : start ? `0/${start[1]}` : "-",
        },
        {
          label: "批大小",
          value: batches ? batches[2] : "-",
        },
      ],
    };
  }

  if (job.type === "folders") {
    const start = findLastMatch(logs, /开始为 (\d+) 个文件生成目录建议/);
    const batches = findLastMatch(
      logs,
      /目录建议将分 (\d+) 批执行，每批最多 (\d+) 个文件/,
    );
    const progress = findLastMatch(logs, /目录建议进度：第 (\d+)\/(\d+) 批已完成/);

    return {
      summary:
        job.status === "failed"
          ? `目录建议失败：${job.error || latestLog}`
          : job.status === "completed"
            ? "目录建议已完成"
            : latestLog,
      items: [
        { label: "任务状态", value: job.status },
        { label: "文件总数", value: start ? start[1] : "-" },
        {
          label: "批次进度",
          value: progress ? `${progress[1]}/${progress[2]}` : batches ? `0/${batches[1]}` : "-",
        },
        { label: "批大小", value: batches ? batches[2] : "-" },
      ],
    };
  }

  if (job.type === "move") {
    const moved = findLastMatch(logs, /已移动 (\d+)\/(\d+)/);
    return {
      summary:
        job.status === "failed"
          ? `移动失败：${job.error || latestLog}`
          : job.status === "completed"
            ? "移动已完成"
            : latestLog,
      items: [
        { label: "任务状态", value: job.status },
        { label: "移动进度", value: moved ? `${moved[1]}/${moved[2]}` : "-" },
      ],
    };
  }

  if (job.type === "scan") {
    const result = findLastMatch(logs, /扫描完成：可分类 (\d+) 个，跳过 (\d+) 个/);
    return {
      summary: latestLog,
      items: [
        { label: "任务状态", value: job.status },
        { label: "可分类", value: result ? result[1] : "-" },
        { label: "已跳过", value: result ? result[2] : "-" },
      ],
    };
  }

  return {
    summary: latestLog,
    items: [{ label: "任务状态", value: job.status }],
  };
}

function updateProxyStatus(data) {
  const network = data?.config?.network || data?.network || {};
  const enabled = Boolean(network.enabled ?? network.proxyUrl);
  proxyStatusBadge.textContent = network.label || (enabled ? "已启用" : "未启用");
  proxyStatusText.textContent = enabled
    ? "当前请求会通过代理转发到 LLM / PikPak。"
    : "当前未启用代理，外部接口可能直连失败。";
  proxyStatusMeta.textContent = `代理地址：${network.proxyUrl || "未配置"}`;
  applyBadgeState(
    proxyStatusBadge,
    enabled ? "status-active" : "status-warn",
  );
}

function updateJobView(job) {
  currentJobState = {
    id: job.id,
    type: job.type,
    status: job.status,
    logs: [...(job.logs || [])],
    error: job.error,
  };
  jobStatus.textContent = `任务状态：${job.status}`;
  logPanel.textContent = (job.logs || []).join("\n");
  renderProgress(deriveJobProgress(job));
}

async function refreshConfigSummary() {
  const data = await getJson("/api/config");
  configPanel.textContent = JSON.stringify(data, null, 2);
  updateProxyStatus(data);
}

async function loadRuntimeSettings() {
  const data = await getJson("/api/settings/runtime");
  runtimeForm.elements.pikpakUsername.value = data.pikpak.username;
  runtimeForm.elements.pikpakPassword.value = data.pikpak.password;
  runtimeForm.elements.sourceFolder.value = data.pikpak.sourceFolder;
  runtimeForm.elements.targetFolder.value = data.pikpak.targetFolder;
  runtimeForm.elements.deviceId.value = data.pikpak.deviceId || "";
  runtimeForm.elements.proxyUrl.value = data.network?.proxyUrl || "";
  runtimeForm.elements.llmApiKey.value = data.llm.apiKey;
  runtimeForm.elements.llmBaseUrl.value = data.llm.baseUrl;
  runtimeForm.elements.llmModel.value = data.llm.model;
  runtimeForm.elements.outputDir.value = data.workflow.outputDir;
  runtimeForm.elements.batchSize.value = data.workflow.batchSize;
  runtimeForm.elements.moveBatchSize.value = data.workflow.moveBatchSize;
  runtimeForm.elements.shortVideoThresholdSeconds.value =
    data.workflow.shortVideoThresholdSeconds;
  runtimeForm.elements.moveMinDelayMs.value = data.workflow.moveMinDelayMs;
  runtimeForm.elements.moveMaxDelayMs.value = data.workflow.moveMaxDelayMs;
  runtimeForm.elements.onlyClassifyVideo.checked =
    data.workflow.onlyClassifyVideo;
  runtimeForm.elements.enableShortVideoFilter.checked =
    data.workflow.enableShortVideoFilter;
}

async function loadPrompts() {
  const data = await getJson("/api/settings/prompts");
  folderPrompt.value = data.folderSuggestion;
  classificationPrompt.value = data.classification;
}

async function loadCategories() {
  const data = await getJson("/api/settings/categories");
  categoryFolders.value = (data.folders || []).join("\n");
}

async function refreshPlan() {
  const plan = await getJson("/api/workflow/plan");
  const classification = await getJson("/api/workflow/classification");

  if (!plan.groups || plan.groups.length === 0) {
    planPanel.textContent = "暂无预览";
  } else {
    planPanel.innerHTML = plan.groups
      .map(
        (group) => `
          <div class="plan-group">
            <strong>${escapeHtml(group.folder)}</strong>
            <div>文件数：${escapeHtml(group.files.length)}</div>
          </div>`,
      )
      .join("");
  }

  if (!classification.items || classification.items.length === 0) {
    classificationTable.innerHTML = '<tr><td colspan="3">暂无数据</td></tr>';
  } else {
    classificationTable.innerHTML = classification.items
      .slice(0, 200)
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.path)}</td>
            <td>${escapeHtml(item.folder)}</td>
          </tr>`,
      )
      .join("");
  }
}

function attachStream(jobId) {
  if (currentEventSource) currentEventSource.close();
  currentJobState = {
    id: jobId,
    type: "unknown",
    status: "pending",
    logs: [],
  };
  logPanel.textContent = "";
  jobStatus.textContent = `任务已创建：${jobId}`;
  renderProgress({
    summary: `任务 ${jobId} 已创建，等待后端开始执行...`,
    items: [{ label: "任务 ID", value: jobId }],
  });
  currentEventSource = new EventSource(`/api/jobs/${jobId}/stream`);

  currentEventSource.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "snapshot") {
      updateJobView(message.payload);
      return;
    }

    if (message.type === "heartbeat") {
      return;
    }

    if (message.type === "status") {
      currentJobState = {
        ...(currentJobState || { id: jobId, type: "unknown", logs: [] }),
        status: message.payload.status,
      };
      jobStatus.textContent = `任务状态：${message.payload.status}`;
      renderProgress(deriveJobProgress(currentJobState));
    }

    if (message.type === "log") {
      currentJobState = {
        ...(currentJobState || { id: jobId, type: "unknown", status: "running", logs: [] }),
        logs: [...((currentJobState && currentJobState.logs) || []), message.payload.message],
      };
      logPanel.textContent += `${message.payload.message}\n`;
      logPanel.scrollTop = logPanel.scrollHeight;
      renderProgress(deriveJobProgress(currentJobState));
    }

    if (message.type === "result") {
      jobStatus.textContent += "（已完成）";
      await refreshPlan();
      await loadCategories();
      await refreshConfigSummary();
    }
  };

  currentEventSource.onerror = async () => {
    currentEventSource.close();
    try {
      const job = await getJson(`/api/jobs/${jobId}`);
      updateJobView(job);
      if (job.status === "completed") {
        jobStatus.textContent += "（已完成）";
        await refreshPlan();
        await loadCategories();
        await refreshConfigSummary();
      } else if (job.status === "failed") {
        jobStatus.textContent += "（执行失败）";
      } else {
        jobStatus.textContent += "（日志流结束）";
      }
    } catch {
      jobStatus.textContent += "（日志流结束）";
    }
  };
}

async function runWorkflow(action) {
  if (action === "move") {
    const confirmed = window.confirm(
      "正式移动会修改 PikPak 中的文件位置，确定继续吗？",
    );
    if (!confirmed) return;
  }

  const routeMap = {
    scan: ["/api/workflow/scan", {}],
    folders: ["/api/workflow/folders", {}],
    classify: ["/api/workflow/classify", {}],
    "dry-run": ["/api/workflow/move", { dryRun: true }],
    move: ["/api/workflow/move", { dryRun: false }],
  };

  const [url, payload] = routeMap[action];
  const data = await getJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  attachStream(data.jobId);
}

runtimeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    network: {
      proxyUrl: runtimeForm.elements.proxyUrl.value,
    },
    pikpak: {
      username: runtimeForm.elements.pikpakUsername.value,
      password: runtimeForm.elements.pikpakPassword.value,
      sourceFolder: runtimeForm.elements.sourceFolder.value,
      targetFolder: runtimeForm.elements.targetFolder.value,
      deviceId: runtimeForm.elements.deviceId.value,
    },
    llm: {
      apiKey: runtimeForm.elements.llmApiKey.value,
      baseUrl: runtimeForm.elements.llmBaseUrl.value,
      model: runtimeForm.elements.llmModel.value,
    },
    workflow: {
      outputDir: runtimeForm.elements.outputDir.value,
      batchSize: Number(runtimeForm.elements.batchSize.value),
      onlyClassifyVideo: runtimeForm.elements.onlyClassifyVideo.checked,
      enableShortVideoFilter:
        runtimeForm.elements.enableShortVideoFilter.checked,
      shortVideoThresholdSeconds: Number(
        runtimeForm.elements.shortVideoThresholdSeconds.value,
      ),
      moveBatchSize: Number(runtimeForm.elements.moveBatchSize.value),
      moveMinDelayMs: Number(runtimeForm.elements.moveMinDelayMs.value),
      moveMaxDelayMs: Number(runtimeForm.elements.moveMaxDelayMs.value),
    },
  };

  await getJson("/api/settings/runtime", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await refreshConfigSummary();
  notify("运行配置已保存到本地文件。");
});

document.getElementById("savePrompts").addEventListener("click", async () => {
  await getJson("/api/settings/prompts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folderSuggestion: folderPrompt.value,
      classification: classificationPrompt.value,
    }),
  });
  notify("Prompt 已保存。");
});

document.getElementById("resetPrompts").addEventListener("click", async () => {
  const data = await getJson("/api/settings/prompts/reset", { method: "POST" });
  folderPrompt.value = data.folderSuggestion;
  classificationPrompt.value = data.classification;
  notify("Prompt 已恢复默认。");
});

document
  .getElementById("saveCategories")
  .addEventListener("click", async () => {
    const folders = categoryFolders.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const data = await getJson("/api/settings/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folders }),
    });
    categoryFolders.value = data.folders.join("\n");
    notify("分类目录已保存。");
  });

document
  .getElementById("syncCategories")
  .addEventListener("click", async () => {
    const data = await getJson("/api/settings/categories/sync", {
      method: "POST",
    });
    categoryFolders.value = data.folders.join("\n");
    notify("已同步目标目录中的现有分类文件夹。");
  });

document.getElementById("refreshConfig").addEventListener("click", async () => {
  await refreshConfigSummary();
  await loadRuntimeSettings();
  await loadPrompts();
  await loadCategories();
});

document.getElementById("refreshPlan").addEventListener("click", refreshPlan);
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runWorkflow(button.dataset.action));
});

Promise.all([
  refreshConfigSummary(),
  loadRuntimeSettings(),
  loadPrompts(),
  loadCategories(),
  refreshPlan(),
]).catch((error) => {
  configPanel.textContent = error.message;
});
