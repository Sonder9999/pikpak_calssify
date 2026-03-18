import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ClassificationArtifacts,
  ClassificationEntry,
  FileEntry,
  FolderSuggestions,
  MovePlan,
  PromptSettings,
  ScanArtifacts,
  SkippedFileEntry,
} from "../types";
import {
  chunk,
  nowIso,
  randomBetween,
  readJsonFile,
  sleep,
  uniqueStrings,
  writeJsonFile,
} from "../utils";
import { JobManager } from "./job-manager";
import { LlmService } from "./llm-service";
import { PikPakClient } from "./pikpak-client";
import { SettingsService } from "./settings-service";

function toTsv(columns: string[], rows: string[][]) {
  return `${columns.join(" | ")}\n${"-".repeat(100)}\n${rows.map((row) => row.join(" | ")).join("\n")}\n`;
}

export function buildMovePlan(items: ClassificationEntry[]): MovePlan {
  const groups = new Map<string, ClassificationEntry[]>();
  for (const item of items) {
    const list = groups.get(item.folder) ?? [];
    list.push(item);
    groups.set(item.folder, list);
  }

  return {
    groups: [...groups.entries()].map(([folder, files]) => ({ folder, files })),
    totalFiles: items.length,
    createdAt: nowIso(),
  };
}

export class WorkflowService {
  constructor(
    private readonly settings: SettingsService,
    private readonly jobs: JobManager,
  ) {}

  private async outputFile(name: string) {
    const config = await this.settings.loadRuntimeConfig();
    return join(process.cwd(), config.workflow.outputDir, name);
  }

  private async getPrompts(): Promise<PromptSettings> {
    return this.settings.getPrompts();
  }

  async getLatestScan() {
    return readJsonFile<ScanArtifacts>(
      await this.outputFile("scan-result.json"),
    );
  }

  async getLatestFolders() {
    return readJsonFile<FolderSuggestions>(
      await this.outputFile("folder-suggestions.json"),
    );
  }

  async getLatestClassification() {
    return readJsonFile<ClassificationArtifacts>(
      await this.outputFile("classification-result.json"),
    );
  }

  async getLatestMovePlan() {
    return readJsonFile<MovePlan>(await this.outputFile("move-plan.json"));
  }

  async syncExistingTargetFolders() {
    const config = await this.settings.loadRuntimeConfig();
    const client = new PikPakClient(config);
    await client.login();
    const folders = await client.listFirstLevelFolders(
      config.pikpak.targetFolder,
    );
    return this.settings.mergeCategoryFolders(folders);
  }

  async scan(jobId: string) {
    const config = await this.settings.loadRuntimeConfig();
    const client = new PikPakClient(config);
    this.jobs.setStatus(jobId, "running");
    this.jobs.log(jobId, "开始登录 PikPak...");
    await client.login();
    this.jobs.log(jobId, "登录成功，开始扫描文件...");

    const allFiles = await client.scanSourceFolder();
    const files: FileEntry[] = [];
    const skipped: SkippedFileEntry[] = [];

    for (const file of allFiles) {
      if (config.workflow.onlyClassifyVideo && !file.isVideo) {
        skipped.push({
          id: file.id,
          path: file.path,
          name: file.name,
          mimeType: file.mimeType,
          reason: "非视频文件",
        });
        continue;
      }
      files.push(file);
    }

    const payload: ScanArtifacts = { files, skipped, createdAt: nowIso() };
    await writeJsonFile(await this.outputFile("scan-result.json"), payload);
    await writeFile(
      await this.outputFile("file_list.txt"),
      toTsv(
        ["文件ID", "路径", "文件名", "大小(bytes)", "MIME类型", "时长(秒)"],
        files.map((file) => [
          file.id,
          file.path,
          file.name,
          String(file.size),
          file.mimeType,
          String(file.durationSeconds),
        ]),
      ),
      "utf8",
    );
    await writeFile(
      await this.outputFile("skipped_files.txt"),
      toTsv(
        ["文件ID", "路径", "文件名", "MIME类型", "原因"],
        skipped.map((file) => [
          file.id,
          file.path,
          file.name,
          file.mimeType,
          file.reason,
        ]),
      ),
      "utf8",
    );

    const result = { fileCount: files.length, skippedCount: skipped.length };
    this.jobs.log(
      jobId,
      `扫描完成：可分类 ${files.length} 个，跳过 ${skipped.length} 个`,
    );
    this.jobs.complete(jobId, result);
    return result;
  }

  async suggestFolders(jobId: string) {
    const config = await this.settings.loadRuntimeConfig();
    const llm = new LlmService(config);
    const prompts = await this.getPrompts();
    const scan = await this.getLatestScan();
    const library = await this.settings.getCategoryFolders();

    this.jobs.setStatus(jobId, "running");
    if (!scan) throw new Error("请先执行扫描");

    this.jobs.log(jobId, `开始为 ${scan.files.length} 个文件生成目录建议...`);
    this.jobs.log(
      jobId,
      `目录建议将分 ${Math.max(1, Math.ceil(scan.files.length / config.workflow.batchSize))} 批执行，每批最多 ${config.workflow.batchSize} 个文件`,
    );
    const folders = await llm.suggestFolders(
      scan.files,
      library.folders,
      prompts,
      ({ completedBatches, totalBatches }) => {
        this.jobs.log(
          jobId,
          `目录建议进度：第 ${completedBatches}/${totalBatches} 批已完成`,
        );
      },
    );
    const mergedLibrary = await this.settings.saveCategoryFolders(folders);

    const payload: FolderSuggestions = {
      folders: mergedLibrary.folders,
      createdAt: nowIso(),
    };
    await writeJsonFile(
      await this.outputFile("folder-suggestions.json"),
      payload,
    );
    await writeFile(
      await this.outputFile("folder_names.txt"),
      `${payload.folders.join("\n")}\n`,
      "utf8",
    );

    const result = { folders: payload.folders };
    this.jobs.log(jobId, `目录建议完成：${payload.folders.join("，")}`);
    this.jobs.complete(jobId, result);
    return result;
  }

  async classify(jobId: string) {
    const config = await this.settings.loadRuntimeConfig();
    const llm = new LlmService(config);
    const prompts = await this.getPrompts();
    const scan = await this.getLatestScan();
    const folderArtifacts = await this.getLatestFolders();
    const library = await this.settings.getCategoryFolders();

    this.jobs.setStatus(jobId, "running");
    if (!scan) throw new Error("请先执行扫描");

    const forcedShortVideos = new Map<string, ClassificationEntry>();
    const llmTargets: FileEntry[] = [];
    for (const file of scan.files) {
      if (
        config.workflow.enableShortVideoFilter &&
        file.durationSeconds > 0 &&
        file.durationSeconds < config.workflow.shortVideoThresholdSeconds
      ) {
        forcedShortVideos.set(file.id, {
          fileId: file.id,
          path: file.path,
          name: file.name,
          folder: "短视频",
        });
      } else {
        llmTargets.push(file);
      }
    }

    const mergedFolders = uniqueStrings([
      ...library.folders,
      ...(folderArtifacts?.folders ?? []),
      ...(forcedShortVideos.size > 0 ? ["短视频"] : []),
      "其他",
    ]).sort((left, right) => left.localeCompare(right));

    this.jobs.log(
      jobId,
      `开始分类：LLM 处理 ${llmTargets.length} 个，短视频直归 ${forcedShortVideos.size} 个`,
    );
    if (llmTargets.length > 0) {
      this.jobs.log(
        jobId,
        `分类将分 ${Math.ceil(llmTargets.length / config.workflow.batchSize)} 批执行，每批最多 ${config.workflow.batchSize} 个文件`,
      );
    }
    const llmResults =
      llmTargets.length > 0
        ? await llm.classifyFiles(
            llmTargets,
            mergedFolders,
            prompts,
            ({
              completedBatches,
              totalBatches,
              completedFiles,
              totalFiles,
            }) => {
              this.jobs.log(
                jobId,
                `分类进度：第 ${completedBatches}/${totalBatches} 批已完成，累计 ${completedFiles}/${totalFiles}`,
              );
            },
          )
        : [];
    const items = [...llmResults, ...forcedShortVideos.values()].sort(
      (left, right) => left.path.localeCompare(right.path),
    );

    const payload: ClassificationArtifacts = {
      folders: mergedFolders,
      items,
      createdAt: nowIso(),
    };
    await writeJsonFile(
      await this.outputFile("classification-result.json"),
      payload,
    );
    await writeFile(
      await this.outputFile("classification.txt"),
      toTsv(
        ["文件ID", "文件路径", "文件名", "分类文件夹"],
        items.map((item) => [item.fileId, item.path, item.name, item.folder]),
      ),
      "utf8",
    );

    const plan = buildMovePlan(items);
    await writeJsonFile(await this.outputFile("move-plan.json"), plan);
    await this.settings.saveCategoryFolders(mergedFolders);

    const result = { fileCount: items.length, folderCount: plan.groups.length };
    this.jobs.log(
      jobId,
      `分类完成：共 ${items.length} 个文件，${plan.groups.length} 个目标文件夹`,
    );
    this.jobs.complete(jobId, result);
    return result;
  }

  async move(jobId: string, dryRun: boolean) {
    const config = await this.settings.loadRuntimeConfig();
    const classification = await this.getLatestClassification();
    this.jobs.setStatus(jobId, "running");
    if (!classification) throw new Error("请先执行分类");

    const plan = buildMovePlan(classification.items);
    await writeJsonFile(await this.outputFile("move-plan.json"), plan);

    if (dryRun) {
      this.jobs.log(
        jobId,
        `Dry Run：共 ${plan.totalFiles} 个文件，${plan.groups.length} 个分组`,
      );
      this.jobs.complete(jobId, plan);
      return plan;
    }

    const client = new PikPakClient(config);
    this.jobs.log(jobId, "开始登录 PikPak，准备执行移动...");
    await client.login();

    let movedCount = 0;
    for (const group of plan.groups) {
      this.jobs.log(
        jobId,
        `准备处理分类：${group.folder}（${group.files.length} 个文件）`,
      );
      const pathIds = await client.pathToId(
        `${config.pikpak.targetFolder}/${group.folder}`,
        true,
      );
      const target = pathIds.at(-1);
      if (!target) throw new Error(`无法创建目标文件夹：${group.folder}`);

      for (const batch of chunk(group.files, config.workflow.moveBatchSize)) {
        await client.batchMove(
          batch.map((item) => item.fileId),
          target.id,
        );
        movedCount += batch.length;
        this.jobs.log(jobId, `已移动 ${movedCount}/${plan.totalFiles}`);
        await sleep(
          randomBetween(
            config.workflow.moveMinDelayMs,
            config.workflow.moveMaxDelayMs,
          ),
        );
      }
    }

    const result = { movedCount, totalFiles: plan.totalFiles };
    this.jobs.complete(jobId, result);
    return result;
  }
}
