import { describe, expect, test } from "bun:test";
import { JobManager } from "../src/services/job-manager";

describe("job manager", () => {
  test("records logs and result", () => {
    const manager = new JobManager();
    const job = manager.createJob("scan");
    manager.setStatus(job.id, "running");
    manager.log(job.id, "开始扫描");
    manager.complete(job.id, { count: 3 });

    const snapshot = manager.snapshot(job.id);
    expect(snapshot.status).toBe("completed");
    expect(snapshot.logs).toContain("开始扫描");
    expect(snapshot.result).toEqual({ count: 3 });
  });

  test("emits failed status when job fails", () => {
    const manager = new JobManager();
    const job = manager.createJob("classify");
    const statuses: string[] = [];

    manager.subscribe(job.id, (event) => {
      if (event.type === "status") {
        statuses.push((event.payload as { status: string }).status);
      }
    });

    manager.fail(job.id, "network error");

    expect(statuses).toContain("failed");
    expect(manager.snapshot(job.id).status).toBe("failed");
  });

  test("marks job as cancelling and cancelled", () => {
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

    expect(statuses).toContain("cancelling");
    expect(statuses).toContain("cancelled");
    expect(manager.snapshot(job.id).status).toBe("cancelled");
  });
});
