import { createAbortError, nowIso } from "../utils";
import type { JobEvent, JobRecord, JobStatus } from "../types";

type Listener = (event: JobEvent) => void;

const TERMINAL_STATUSES: JobStatus[] = ["completed", "failed", "cancelled"];

export class JobManager {
  private jobs = new Map<string, JobRecord>();
  private listeners = new Map<string, Set<Listener>>();
  private controllers = new Map<string, AbortController>();

  createJob(type: string) {
    const id = crypto.randomUUID();
    const job: JobRecord = {
      id,
      type,
      status: "pending",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      logs: [],
    };
    this.jobs.set(id, job);
    this.controllers.set(id, new AbortController());
    return job;
  }

  getJob(id: string) {
    return this.jobs.get(id) ?? null;
  }

  getSignal(id: string) {
    return this.getControllerOrThrow(id).signal;
  }

  subscribe(id: string, listener: Listener) {
    const listeners = this.listeners.get(id) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    return () => {
      const current = this.listeners.get(id);
      current?.delete(listener);
    };
  }

  private emit(id: string, event: JobEvent) {
    const listeners = this.listeners.get(id);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(event);
    }
  }

  setStatus(id: string, status: JobStatus) {
    const job = this.getJobOrThrow(id);
    job.status = status;
    job.updatedAt = nowIso();
    this.emit(id, { type: "status", timestamp: nowIso(), payload: { status } });
  }

  log(id: string, message: string) {
    const job = this.getJobOrThrow(id);
    job.logs.push(message);
    job.updatedAt = nowIso();
    this.emit(id, { type: "log", timestamp: nowIso(), payload: { message } });
  }

  complete(id: string, result?: unknown) {
    const job = this.getJobOrThrow(id);
    if (job.status === "cancelled") return;
    job.status = "completed";
    job.result = result;
    job.updatedAt = nowIso();
    this.emit(id, {
      type: "status",
      timestamp: nowIso(),
      payload: { status: "completed" },
    });
    this.emit(id, {
      type: "result",
      timestamp: nowIso(),
      payload: result ?? null,
    });
  }

  fail(id: string, error: string) {
    const job = this.getJobOrThrow(id);
    if (job.status === "cancelled") return;
    job.status = "failed";
    job.error = error;
    job.updatedAt = nowIso();
    this.emit(id, {
      type: "status",
      timestamp: nowIso(),
      payload: { status: "failed" },
    });
    this.log(id, `错误：${error}`);
  }

  cancel(id: string) {
    const job = this.getJobOrThrow(id);
    if (TERMINAL_STATUSES.includes(job.status)) {
      return job;
    }

    job.status = "cancelling";
    job.updatedAt = nowIso();
    this.emit(id, {
      type: "status",
      timestamp: nowIso(),
      payload: { status: "cancelling" },
    });
    this.log(id, "收到停止请求，正在尝试中止任务...");

    const controller = this.getControllerOrThrow(id);
    if (!controller.signal.aborted) {
      controller.abort(createAbortError());
    }
    return job;
  }

  cancelled(id: string, message = "任务已停止") {
    const job = this.getJobOrThrow(id);
    if (job.status === "cancelled") return job;
    job.status = "cancelled";
    job.error = message;
    job.updatedAt = nowIso();
    this.emit(id, {
      type: "status",
      timestamp: nowIso(),
      payload: { status: "cancelled" },
    });
    this.log(id, message);
    return job;
  }

  snapshot(id: string) {
    return this.getJobOrThrow(id);
  }

  private getJobOrThrow(id: string) {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`任务不存在：${id}`);
    }
    return job;
  }

  private getControllerOrThrow(id: string) {
    const controller = this.controllers.get(id);
    if (!controller) {
      throw new Error(`任务控制器不存在：${id}`);
    }
    return controller;
  }
}
