import { describe, expect, test } from "bun:test";
import { buildMovePlan } from "../src/services/workflow-service";

describe("workflow service", () => {
  test("groups classification entries into move plan", () => {
    const plan = buildMovePlan([
      { fileId: "1", path: "a.mp4", name: "a.mp4", folder: "Genshin Impact" },
      { fileId: "2", path: "b.mp4", name: "b.mp4", folder: "其他" },
      { fileId: "3", path: "c.mp4", name: "c.mp4", folder: "Genshin Impact" },
    ]);

    expect(plan.totalFiles).toBe(3);
    expect(plan.groups).toHaveLength(2);
    expect(
      plan.groups.find((group) => group.folder === "Genshin Impact")?.files,
    ).toHaveLength(2);
  });
});
