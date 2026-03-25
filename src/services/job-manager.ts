import { createAbortError, nowIso } from "../utils";
import type {
  JobEvent,
  JobLogEntry,
  JobLogLevel,
  JobRecord,
  JobStatus,
} from "../types";

type Listener = (event: JobEvent) => void;

const TERMINAL_STATUSES: JobStatus[] = ["completed", "failed", "cancelled"];

export class JobManager {
  private jobs = new Map<string, JobRecord>();
  private listeners = new Map<string, Set<Listener>>();
  private controllers = new Map<string, AbortController>();

  createJob(type: string) {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const job: JobRecord = {
      id,
      type,
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
      logs: [],
      logEntries: [],
    };
    this.jobs.set(id, job);
    this.controllers.set(id, new AbortController());
    return job;
  }

  getJob(id: string) {
    return this.jobs.get(id) ?? null;
  }

  listJobs() {
    return [...this.jobs.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
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

  private appendLogEntry(
    id: string,
    message: string,
    level: JobLogLevel,
    context?: Record<string, string | number | boolean | null>,
  ) {
    const job = this.getJobOrThrow(id);
    const timestamp = nowIso();
    const entry: JobLogEntry = {
      level,
      step: job.type,
      message,
      timestamp,
      context,
    };
    job.logs.push(message);
    job.logEntries = [...(job.logEntries ?? []), entry];
    job.updatedAt = timestamp;
    this.emit(id, {
      type: "log",
      timestamp,
      payload: { message, entry },
    });
  }

  setStatus(id: string, status: JobStatus) {
    const job = this.getJobOrThrow(id);
    const timestamp = nowIso();
    job.status = status;
    job.updatedAt = timestamp;
    this.emit(id, { type: "status", timestamp, payload: { status } });
  }

  log(
    id: string,
    message: string,
    options?: {
      level?: JobLogLevel;
      context?: Record<string, string | number | boolean | null>;
    },
  ) {
    this.appendLogEntry(
      id,
      message,
      options?.level ?? "info",
      options?.context,
    );
  }

  complete(id: string, result?: unknown) {
    const job = this.getJobOrThrow(id);
    if (job.status === "cancelled") return;
    const timestamp = nowIso();
    job.status = "completed";
    job.result = result;
    job.updatedAt = timestamp;
    this.emit(id, {
      type: "status",
      timestamp,
      payload: { status: "completed" },
    });
    this.emit(id, {
      type: "result",
      timestamp,
      payload: result ?? null,
    });
  }

  fail(id: string, error: string) {
    const job = this.getJobOrThrow(id);
    if (job.status === "cancelled") return;
    const timestamp = nowIso();
    job.status = "failed";
    job.error = error;
    job.updatedAt = timestamp;
    this.emit(id, {
      type: "status",
      timestamp,
      payload: { status: "failed" },
    });
    this.appendLogEntry(id, `Error: ${error}`, "error");
  }

  cancel(id: string) {
    const job = this.getJobOrThrow(id);
    if (TERMINAL_STATUSES.includes(job.status)) {
      return job;
    }

    const timestamp = nowIso();
    job.status = "cancelling";
    job.updatedAt = timestamp;
    this.emit(id, {
      type: "status",
      timestamp,
      payload: { status: "cancelling" },
    });
    this.appendLogEntry(
      id,
      "Cancellation requested. Stopping the job...",
      "warn",
    );

    const controller = this.getControllerOrThrow(id);
    if (!controller.signal.aborted) {
      controller.abort(createAbortError());
    }
    return job;
  }

  cancelled(id: string, message = "Job cancelled") {
    const job = this.getJobOrThrow(id);
    if (job.status === "cancelled") return job;
    const timestamp = nowIso();
    job.status = "cancelled";
    job.error = message;
    job.updatedAt = timestamp;
    this.emit(id, {
      type: "status",
      timestamp,
      payload: { status: "cancelled" },
    });
    this.appendLogEntry(id, message, "warn");
    return job;
  }

  snapshot(id: string) {
    return this.getJobOrThrow(id);
  }

  private getJobOrThrow(id: string) {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }
    return job;
  }

  private getControllerOrThrow(id: string) {
    const controller = this.controllers.get(id);
    if (!controller) {
      throw new Error(`Abort controller not found: ${id}`);
    }
    return controller;
  }
}
