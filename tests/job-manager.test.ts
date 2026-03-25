import { describe, expect, test } from "bun:test";
import { JobManager } from "../src/services/job-manager";

describe("job manager", () => {
  test("records structured log entries alongside string logs", () => {
    const manager = new JobManager();
    const job = manager.createJob("scan");
    manager.setStatus(job.id, "running");
    manager.log(job.id, "scan started");
    manager.complete(job.id, { count: 3 });

    const snapshot = manager.snapshot(job.id);
    expect(snapshot.status).toBe("completed");
    expect(snapshot.logs).toContain("scan started");
    expect(snapshot.logEntries).toHaveLength(1);
    expect(snapshot.logEntries?.[0]).toMatchObject({
      level: "info",
      step: "scan",
      message: "scan started",
    });
    expect(snapshot.result).toEqual({ count: 3 });
  });

  test("emits failed status and records error-level logs", () => {
    const manager = new JobManager();
    const job = manager.createJob("classify");
    const statuses: string[] = [];

    manager.subscribe(job.id, (event) => {
      if (event.type === "status") {
        statuses.push((event.payload as { status: string }).status);
      }
    });

    manager.fail(job.id, "network error");

    const snapshot = manager.snapshot(job.id);
    expect(statuses).toContain("failed");
    expect(snapshot.status).toBe("failed");
    expect(snapshot.logEntries?.at(-1)).toMatchObject({
      level: "error",
      step: "classify",
    });
  });

  test("marks job as cancelling and cancelled with warning logs", () => {
    const manager = new JobManager();
    const job = manager.createJob("classify");
    const statuses: string[] = [];

    manager.subscribe(job.id, (event) => {
      if (event.type === "status") {
        statuses.push((event.payload as { status: string }).status);
      }
    });

    manager.setStatus(job.id, "running");
    const signal = manager.getSignal(job.id);
    manager.cancel(job.id);

    expect(signal.aborted).toBe(true);
    expect(manager.snapshot(job.id).status).toBe("cancelling");

    manager.cancelled(job.id);

    const snapshot = manager.snapshot(job.id);
    expect(statuses).toContain("cancelling");
    expect(statuses).toContain("cancelled");
    expect(snapshot.status).toBe("cancelled");
    expect(snapshot.logEntries?.some((entry) => entry.level === "warn")).toBe(
      true,
    );
  });

  test("lists latest jobs newest first", async () => {
    const manager = new JobManager();
    const first = manager.createJob("scan");
    await Bun.sleep(2);
    const second = manager.createJob("classify");

    const jobs = manager.listJobs();

    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.id).toBe(second.id);
    expect(jobs[1]?.id).toBe(first.id);
  });
});
