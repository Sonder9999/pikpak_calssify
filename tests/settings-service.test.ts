import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SettingsService } from "../src/services/settings-service";

const createdDirs = [];

afterEach(async () => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    await rm(dir, { recursive: true, force: true });
  }
});

describe("settings service", () => {
  test("creates default data files and persists category folders", async () => {
    const root = await mkdtemp(join(tmpdir(), "pikpak-settings-"));
    createdDirs.push(root);
    await mkdir(join(root), { recursive: true });
    await writeFile(join(root, ".env"), "PIKPAK_USERNAME=user@example.com\nPIKPAK_PASSWORD=secret\nPIKPAK_SOURCE_FOLDER=Media\nPIKPAK_TARGET_FOLDER=Archive\nLLM_API_KEY=demo\n\n", "utf8");

    const service = new SettingsService(root);
    await service.ensureDataFiles();
    const prompts = await service.getPrompts();
    const folders = await service.saveCategoryFolders(["分类B", "分类A"]);

    expect(prompts.folderSuggestion.length).toBeGreaterThan(10);
    expect(folders.folders).toEqual(["其他", "分类A", "分类B"]);
  });
});
