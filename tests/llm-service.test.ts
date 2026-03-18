import { afterEach, describe, expect, mock, test } from "bun:test";
import { LlmService } from "../src/services/llm-service";
import type { AppConfig, PromptSettings } from "../src/types";

const config = {
  port: 3000,
  network: { proxyUrl: "http://127.0.0.1:7890" },
  pikpak: {
    username: "user@example.com",
    password: "secret",
    sourceFolder: "Media",
    targetFolder: "Archive",
  },
  llm: {
    apiKey: "demo-key",
    baseUrl: "https://example.com/v1",
    model: "demo-model",
  },
  workflow: {
    outputDir: "output",
    batchSize: 100,
    onlyClassifyVideo: true,
    enableShortVideoFilter: true,
    shortVideoThresholdSeconds: 180,
    moveBatchSize: 20,
    moveMinDelayMs: 1000,
    moveMaxDelayMs: 2000,
  },
} satisfies AppConfig;

const prompts: PromptSettings = {
  folderSuggestion: "{{existingFolders}}\n{{fileList}}",
  classification: "{{folders}}\n{{fileList}}",
  updatedAt: new Date().toISOString(),
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("llm service", () => {
  test("passes proxy configuration to fetch", async () => {
    const captured: Array<unknown> = [];
    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit & { proxy?: unknown }) => {
      captured.push(init?.proxy);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"folders":["分类A"]}' } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const service = new LlmService(config);
    await service.suggestFolders(
      [{ id: "1", path: "a.mp4", name: "a.mp4", size: 1, mimeType: "video/mp4", durationSeconds: 0, isVideo: true }],
      ["其他"],
      prompts,
    );

    expect(captured[0]).toBe("http://127.0.0.1:7890");
  });

  test("passes abort signal to fetch", async () => {
    const captured: Array<AbortSignal | null | undefined> = [];
    globalThis.fetch = mock(
      async (
        _url: string | URL | Request,
        init?: RequestInit & { proxy?: unknown },
      ) => {
        captured.push(init?.signal);
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"folders":["分类A"]}' } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    ) as typeof fetch;

    const signal = new AbortController().signal;
    const service = new LlmService(config);
    await service.suggestFolders(
      [{ id: "1", path: "a.mp4", name: "a.mp4", size: 1, mimeType: "video/mp4", durationSeconds: 0, isVideo: true }],
      ["其他"],
      prompts,
      undefined,
      signal,
    );

    expect(captured[0]).toBe(signal);
  });
});
