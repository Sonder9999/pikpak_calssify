const configPanel = document.getElementById("configPanel");
const logPanel = document.getElementById("logPanel");
const planPanel = document.getElementById("planPanel");
const classificationTable = document.getElementById("classificationTable");
const jobStatus = document.getElementById("jobStatus");

let currentEventSource = null;

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "请求失败");
  }
  return response.json();
}

async function refreshConfig() {
  const data = await getJson("/api/config");
  configPanel.textContent = JSON.stringify(data, null, 2);
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
            <strong>${group.folder}</strong>
            <div>文件数：${group.files.length}</div>
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
            <td>${item.name}</td>
            <td>${item.path}</td>
            <td>${item.folder}</td>
          </tr>`,
      )
      .join("");
  }
}

function attachStream(jobId) {
  if (currentEventSource) currentEventSource.close();
  logPanel.textContent = "";
  jobStatus.textContent = `任务已创建：${jobId}`;
  currentEventSource = new EventSource(`/api/jobs/${jobId}/stream`);

  currentEventSource.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "snapshot") {
      const job = message.payload;
      jobStatus.textContent = `任务状态：${job.status}`;
      logPanel.textContent = (job.logs || []).join("\n");
      return;
    }

    if (message.type === "status") {
      jobStatus.textContent = `任务状态：${message.payload.status}`;
    }

    if (message.type === "log") {
      logPanel.textContent += `${message.payload.message}\n`;
      logPanel.scrollTop = logPanel.scrollHeight;
    }

    if (message.type === "result") {
      jobStatus.textContent += "（已完成）";
      await refreshPlan();
    }
  };

  currentEventSource.onerror = () => {
    jobStatus.textContent += "（日志流结束）";
    currentEventSource.close();
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

document
  .getElementById("refreshConfig")
  .addEventListener("click", refreshConfig);
document.getElementById("refreshPlan").addEventListener("click", refreshPlan);

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runWorkflow(button.dataset.action));
});

refreshConfig().catch((error) => {
  configPanel.textContent = error.message;
});
refreshPlan().catch(() => {});
