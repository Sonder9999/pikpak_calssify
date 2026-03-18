import type { AppConfig, ClassificationEntry, FileEntry } from "../types";
import { chunk, extractJsonBlock, uniqueStrings } from "../utils";

export function buildFolderSuggestionPrompt(files: FileEntry[]) {
  return [
    "你是一个中文文件分类助手。",
    "目标：根据视频文件名称和路径，为这批文件生成适合的分类文件夹名称。",
    "要求：",
    '1. 输出 JSON 对象，格式为 {"folders": ["分类1", "分类2"] }。',
    "2. 文件夹名应简短、可读、适合直接作为目录名称。",
    "3. 可以包含作品名、角色名、主题名、风格名，但不要输出过度细碎的名字。",
    "4. 如果无法判断，使用“其他”。",
    "5. 只输出 JSON，不要输出额外解释。",
    "文件列表：",
    ...files.map((file) => `- ${file.path}`),
  ].join("\n");
}

export function buildClassificationPrompt(
  files: FileEntry[],
  folders: string[],
) {
  return [
    "你是一个中文文件分类助手。",
    "目标：把每个文件分配到最合适的文件夹。",
    "要求：",
    "1. 只能从给定的文件夹候选中选择。",
    '2. 输出 JSON 对象，格式为 {"items": [{"id": "文件ID", "folder": "分类名"}] }。',
    "3. 必须覆盖每一个文件。",
    "4. 如果不确定，归入“其他”。",
    "5. 只输出 JSON，不要输出解释。",
    `候选文件夹：${folders.join(", ")}`,
    "文件列表：",
    ...files.map((file) => `- ${file.id} | ${file.path}`),
  ].join("\n");
}

export class LlmService {
  constructor(private readonly config: AppConfig) {}

  async suggestFolders(files: FileEntry[]) {
    if (!this.config.llm.apiKey) {
      throw new Error("未配置 LLM_API_KEY，无法生成分类文件夹");
    }

    const batches = chunk(files, this.config.workflow.batchSize);
    const folders: string[] = [];

    for (const batch of batches) {
      const response = await this.complete(buildFolderSuggestionPrompt(batch));
      const json = JSON.parse(extractJsonBlock(response)) as {
        folders?: string[];
      };
      folders.push(...(json.folders || []));
    }

    const merged = uniqueStrings([...folders, "其他"]);
    return merged.length > 0 ? merged : ["其他"];
  }

  async classifyFiles(files: FileEntry[], folders: string[]) {
    if (!this.config.llm.apiKey) {
      throw new Error("未配置 LLM_API_KEY，无法执行分类");
    }

    const results: ClassificationEntry[] = [];
    const folderSet = new Set(folders);
    const batches = chunk(files, this.config.workflow.batchSize);

    for (const batch of batches) {
      const response = await this.complete(
        buildClassificationPrompt(batch, folders),
      );
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
