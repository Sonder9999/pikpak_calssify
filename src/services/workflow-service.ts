import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AppConfig,
  ClassificationArtifacts,
  ClassificationEntry,
  FileEntry,
  FolderSuggestions,
  MovePlan,
  ScanArtifacts,
  SkippedFileEntry,
} from "../types";
import {
  chunk,
  nowIso,
  randomBetween,
  readJsonFile,
  sleep,
  writeJsonFile,
} from "../utils";
import { JobManager } from "./job-manager";
import { LlmService } from "./llm-service";
import { PikPakClient } from "./pikpak-client";

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
  private readonly llm: LlmService;

  constructor(
    private readonly config: AppConfig,
    private readonly jobs: JobManager,
  ) {
    this.llm = new LlmService(config);
  }

  private file(name: string) {
    return join(process.cwd(), this.config.workflow.outputDir, name);
  }

  async getLatestScan() {
    return readJsonFile<ScanArtifacts>(this.file("scan-result.json"));
  }

  async getLatestFolders() {
    return readJsonFile<FolderSuggestions>(
      this.file("folder-suggestions.json"),
    );
  }

  async getLatestClassification() {
    return readJsonFile<ClassificationArtifacts>(
      this.file("classification-result.json"),
    );
  }

  async getLatestMovePlan() {
    return readJsonFile<MovePlan>(this.file("move-plan.json"));
  }

  async scan(jobId: string) {
    const client = new PikPakClient(this.config);
    this.jobs.setStatus(jobId, "running");
    this.jobs.log(jobId, "开始登录 PikPak...");
    await client.login();
    this.jobs.log(jobId, "登录成功，开始扫描文件...");

    const allFiles = await client.scanSourceFolder();
    const files: FileEntry[] = [];
    const skipped: SkippedFileEntry[] = [];

    for (const file of allFiles) {
      if (this.config.workflow.onlyClassifyVideo && !file.isVideo) {
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
    await writeJsonFile(this.file("scan-result.json"), payload);
    await writeFile(
      this.file("file_list.txt"),
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
      this.file("skipped_files.txt"),
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
    this.jobs.setStatus(jobId, "running");
    const scan = await this.getLatestScan();
    if (!scan) {
      throw new Error("请先执行扫描");
    }

    this.jobs.log(
      jobId,
      `开始为 ${scan.files.length} 个文件生成分类目录建议...`,
    );
    const folders = await this.llm.suggestFolders(scan.files);
    const payload: FolderSuggestions = { folders, createdAt: nowIso() };
    await writeJsonFile(this.file("folder-suggestions.json"), payload);
    await writeFile(
      this.file("folder_names.txt"),
      `${folders.join("\n")}\n`,
      "utf8",
    );

    const result = { folders };
    this.jobs.log(jobId, `目录建议完成：${folders.join("，")}`);
    this.jobs.complete(jobId, result);
    return result;
  }

  async classify(jobId: string) {
    this.jobs.setStatus(jobId, "running");
    const scan = await this.getLatestScan();
    const folderArtifacts = await this.getLatestFolders();
    if (!scan) throw new Error("请先执行扫描");
    if (!folderArtifacts) throw new Error("请先生成目录建议");

    const forcedShortVideos = new Map<string, ClassificationEntry>();
    const llmTargets: FileEntry[] = [];

    for (const file of scan.files) {
      if (
        this.config.workflow.enableShortVideoFilter &&
        file.durationSeconds > 0 &&
        file.durationSeconds < this.config.workflow.shortVideoThresholdSeconds
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

    const folders = [...folderArtifacts.folders];
    if (forcedShortVideos.size > 0 && !folders.includes("短视频")) {
      folders.push("短视频");
    }
    if (!folders.includes("其他")) {
      folders.push("其他");
    }

    this.jobs.log(
      jobId,
      `开始分类：LLM 处理 ${llmTargets.length} 个，短视频直归 ${forcedShortVideos.size} 个`,
    );
    const llmResults =
      llmTargets.length > 0
        ? await this.llm.classifyFiles(llmTargets, folders)
        : [];
    const items = [...llmResults, ...forcedShortVideos.values()].sort(
      (left, right) => left.path.localeCompare(right.path),
    );

    const payload: ClassificationArtifacts = {
      folders,
      items,
      createdAt: nowIso(),
    };
    await writeJsonFile(this.file("classification-result.json"), payload);
    await writeFile(
      this.file("classification.txt"),
      toTsv(
        ["文件ID", "文件路径", "文件名", "分类文件夹"],
        items.map((item) => [item.fileId, item.path, item.name, item.folder]),
      ),
      "utf8",
    );

    const plan = buildMovePlan(items);
    await writeJsonFile(this.file("move-plan.json"), plan);

    const result = { fileCount: items.length, folderCount: plan.groups.length };
    this.jobs.log(
      jobId,
      `分类完成：共 ${items.length} 个文件，${plan.groups.length} 个目标文件夹`,
    );
    this.jobs.complete(jobId, result);
    return result;
  }

  async move(jobId: string, dryRun: boolean) {
    this.jobs.setStatus(jobId, "running");
    const classification = await this.getLatestClassification();
    if (!classification) {
      throw new Error("请先执行分类");
    }

    const plan = buildMovePlan(classification.items);
    await writeJsonFile(this.file("move-plan.json"), plan);

    if (dryRun) {
      this.jobs.log(
        jobId,
        `Dry Run：共 ${plan.totalFiles} 个文件，${plan.groups.length} 个分组`,
      );
      this.jobs.complete(jobId, plan);
      return plan;
    }

    const client = new PikPakClient(this.config);
    this.jobs.log(jobId, "开始登录 PikPak，准备执行移动...");
    await client.login();

    let movedCount = 0;
    for (const group of plan.groups) {
      this.jobs.log(
        jobId,
        `准备处理分类：${group.folder}（${group.files.length} 个文件）`,
      );
      const pathIds = await client.pathToId(
        `${this.config.pikpak.targetFolder}/${group.folder}`,
        true,
      );
      const target = pathIds.at(-1);
      if (!target) {
        throw new Error(`无法创建目标文件夹：${group.folder}`);
      }

      for (const batch of chunk(
        group.files,
        this.config.workflow.moveBatchSize,
      )) {
        await client.batchMove(
          batch.map((item) => item.fileId),
          target.id,
        );
        movedCount += batch.length;
        this.jobs.log(jobId, `已移动 ${movedCount}/${plan.totalFiles}`);
        await sleep(
          randomBetween(
            this.config.workflow.moveMinDelayMs,
            this.config.workflow.moveMaxDelayMs,
          ),
        );
      }
    }

    const result = { movedCount, totalFiles: plan.totalFiles };
    this.jobs.complete(jobId, result);
    return result;
  }
}
