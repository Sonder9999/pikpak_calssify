import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getMaskedConfigSummary,
  loadConfigFromEnvMap,
  parseEnvText,
  runtimeSettingsToEnvMap,
  serializeEnvMap,
  validateConfig,
  validateLlmConfig,
} from "../config";
import type {
  AppConfig,
  CategoryFolderLibrary,
  PromptSettings,
  RuntimeSettingsPayload,
} from "../types";
import { nowIso, readJsonFile, uniqueStrings, writeJsonFile } from "../utils";

const DEFAULT_FOLDER_PROMPT = [
  "你是一个中文文件分类助手。",
  "目标：根据视频文件名称和路径，为这批文件生成适合的分类文件夹名称。",
  "已有分类目录（优先复用，不要重复创造相近名称）：",
  "{{existingFolders}}",
  "要求：",
  '1. 输出 JSON 对象，格式为 {"folders": ["分类1", "分类2"] }。',
  "2. 文件夹名应简短、可读、适合直接作为目录名称。",
  "3. 可以包含作品名、角色名、主题名、风格名，但不要输出过度细碎的名字。",
  "4. 如果无法判断，使用“其他”。",
  "5. 只输出 JSON，不要输出额外解释。",
  "文件列表：",
  "{{fileList}}",
].join("\n");

const DEFAULT_CLASSIFICATION_PROMPT = [
  "你是一个中文文件分类助手。",
  "目标：把每个文件分配到最合适的文件夹。",
  "已有和可用文件夹候选：",
  "{{folders}}",
  "要求：",
  "1. 只能从给定的文件夹候选中选择。",
  '2. 输出 JSON 对象，格式为 {"items": [{"id": "文件ID", "folder": "分类名"}] }。',
  "3. 必须覆盖每一个文件。",
  "4. 如果不确定，归入“其他”。",
  "5. 只输出 JSON，不要输出解释。",
  "文件列表：",
  "{{fileList}}",
].join("\n");

function sortFolders(folders: string[]) {
  const unique = uniqueStrings([...folders, "其他"]).filter(Boolean);
  const others = unique.filter((folder) => folder === "其他");
  const rest = unique
    .filter((folder) => folder !== "其他")
    .sort((left, right) => left.localeCompare(right));
  return [...others, ...rest];
}

export class SettingsService {
  private readonly envPath: string;
  private readonly dataDir: string;
  private readonly promptsPath: string;
  private readonly foldersPath: string;

  constructor(private readonly rootDir = process.cwd()) {
    this.envPath = join(rootDir, ".env");
    this.dataDir = join(rootDir, "data");
    this.promptsPath = join(this.dataDir, "prompts.json");
    this.foldersPath = join(this.dataDir, "category-folders.json");
  }

  async ensureDataFiles() {
    await mkdir(this.dataDir, { recursive: true });

    const prompts = await readJsonFile<PromptSettings>(this.promptsPath);
    if (!prompts) {
      await this.savePrompts({
        folderSuggestion: DEFAULT_FOLDER_PROMPT,
        classification: DEFAULT_CLASSIFICATION_PROMPT,
      });
    }

    const folders = await readJsonFile<CategoryFolderLibrary>(this.foldersPath);
    if (!folders) {
      await this.saveCategoryFolders(["其他"]);
    }
  }

  async loadRuntimeConfig(): Promise<AppConfig> {
    const text = await readFile(this.envPath, "utf8");
    return loadConfigFromEnvMap(parseEnvText(text));
  }

  async saveRuntimeConfig(
    settings: RuntimeSettingsPayload & { port?: number },
  ) {
    const envText = serializeEnvMap(runtimeSettingsToEnvMap(settings));
    await writeFile(this.envPath, envText, "utf8");
    return this.loadRuntimeConfig();
  }

  async getMaskedRuntimeConfig() {
    const config = await this.loadRuntimeConfig();
    return {
      config: getMaskedConfigSummary(config),
      validation: validateConfig(config),
      llmValidation: validateLlmConfig(config),
    };
  }

  async getEditableRuntimeConfig() {
    const config = await this.loadRuntimeConfig();
    return {
      port: config.port,
      network: config.network,
      pikpak: config.pikpak,
      llm: config.llm,
      workflow: config.workflow,
      validation: validateConfig(config),
      llmValidation: validateLlmConfig(config),
    };
  }

  async getPrompts() {
    const prompts = await readJsonFile<PromptSettings>(this.promptsPath);
    return (
      prompts ?? {
        folderSuggestion: DEFAULT_FOLDER_PROMPT,
        classification: DEFAULT_CLASSIFICATION_PROMPT,
        updatedAt: nowIso(),
      }
    );
  }

  async savePrompts(
    input: Pick<PromptSettings, "folderSuggestion" | "classification">,
  ) {
    const prompts: PromptSettings = {
      folderSuggestion: input.folderSuggestion,
      classification: input.classification,
      updatedAt: nowIso(),
    };
    await writeJsonFile(this.promptsPath, prompts);
    return prompts;
  }

  async resetPrompts() {
    return this.savePrompts({
      folderSuggestion: DEFAULT_FOLDER_PROMPT,
      classification: DEFAULT_CLASSIFICATION_PROMPT,
    });
  }

  async getCategoryFolders() {
    const library = await readJsonFile<CategoryFolderLibrary>(this.foldersPath);
    return library ?? { folders: ["其他"], updatedAt: nowIso() };
  }

  async saveCategoryFolders(folders: string[]) {
    const library: CategoryFolderLibrary = {
      folders: sortFolders(folders),
      updatedAt: nowIso(),
    };
    await writeJsonFile(this.foldersPath, library);
    return library;
  }

  async mergeCategoryFolders(folders: string[]) {
    const current = await this.getCategoryFolders();
    return this.saveCategoryFolders([...current.folders, ...folders]);
  }
}
