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
});
