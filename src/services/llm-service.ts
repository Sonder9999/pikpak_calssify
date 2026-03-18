import type {
  AppConfig,
  ClassificationEntry,
  FileEntry,
  PromptSettings,
} from "../types";
import {
  chunk,
  extractJsonBlock,
  renderTemplate,
  uniqueStrings,
} from "../utils";

function lines(items: string[]) {
  return items.length > 0
    ? items.map((item) => `- ${item}`).join("\n")
    : "- 其他";
}

export class LlmService {
  constructor(private readonly config: AppConfig) {}

  async suggestFolders(
    files: FileEntry[],
    existingFolders: string[],
    prompts: PromptSettings,
    onProgress?: (progress: { completedBatches: number; totalBatches: number }) => void | Promise<void>,
  ) {
    if (!this.config.llm.apiKey) {
      throw new Error("未配置 LLM_API_KEY，无法生成分类文件夹");
    }

    const batches = chunk(files, this.config.workflow.batchSize);
    const folders: string[] = [];

    for (const [index, batch] of batches.entries()) {
      const prompt = renderTemplate(prompts.folderSuggestion, {
        existingFolders: lines(existingFolders),
        fileList: lines(batch.map((file) => file.path)),
      });
      const response = await this.complete(prompt);
      const json = JSON.parse(extractJsonBlock(response)) as {
        folders?: string[];
      };
      folders.push(...(json.folders || []));
      await onProgress?.({
        completedBatches: index + 1,
        totalBatches: batches.length,
      });
    }

    return uniqueStrings([...existingFolders, ...folders, "其他"]);
  }

  async classifyFiles(
    files: FileEntry[],
    folders: string[],
    prompts: PromptSettings,
    onProgress?: (progress: {
      completedBatches: number;
      totalBatches: number;
      completedFiles: number;
      totalFiles: number;
    }) => void | Promise<void>,
  ) {
    if (!this.config.llm.apiKey) {
      throw new Error("未配置 LLM_API_KEY，无法执行分类");
    }

    const results: ClassificationEntry[] = [];
    const folderSet = new Set(folders);
    const batches = chunk(files, this.config.workflow.batchSize);

    for (const [index, batch] of batches.entries()) {
      const prompt = renderTemplate(prompts.classification, {
        folders: lines(folders),
        fileList: lines(batch.map((file) => `${file.id} | ${file.path}`)),
      });
      const response = await this.complete(prompt);
      const json = JSON.parse(extractJsonBlock(response)) as {
        items?: Array<{ id: string; folder: string }>;
      };
      for (const item of json.items || []) {
        const file = batch.find((entry) => entry.id === item.id);
        if (!file) continue;
        const folder = folderSet.has(item.folder) ? item.folder : "其他";
        results.push({
          fileId: file.id,
          path: file.path,
          name: file.name,
          folder,
        });
      }
      await onProgress?.({
        completedBatches: index + 1,
        totalBatches: batches.length,
        completedFiles: Math.min((index + 1) * this.config.workflow.batchSize, files.length),
        totalFiles: files.length,
      });
    }

    if (results.length !== files.length) {
      const mappedIds = new Set(results.map((entry) => entry.fileId));
      for (const file of files) {
        if (!mappedIds.has(file.id)) {
          results.push({
            fileId: file.id,
            path: file.path,
            name: file.name,
            folder: "其他",
          });
        }
      }
    }

    return results;
  }

  private async complete(prompt: string) {
    const url = `${this.config.llm.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      proxy: this.config.network.proxyUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.llm.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: "你是一个严谨的中文分类助手。" },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message || "LLM 请求失败");
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LLM 未返回内容");
    }
    return content;
  }
}
