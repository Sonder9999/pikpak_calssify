import { describe, expect, test } from "bun:test";
import {
  getMaskedConfigSummary,
  validateConfig,
  validateLlmConfig,
} from "../src/config";
import type { AppConfig } from "../src/types";

const config: AppConfig = {
  port: 3000,
  pikpak: {
    username: "demo@example.com",
    password: "super-secret",
    sourceFolder: "Sonder/Blue",
    targetFolder: "Blue",
    deviceId: "abcdef123456",
  },
  llm: {
    apiKey: "sk-demo-secret",
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
};

describe("config", () => {
  test("validates required runtime config", () => {
    expect(validateConfig(config).valid).toBe(true);
    expect(validateLlmConfig(config).valid).toBe(true);
  });

  test("masks secrets in summary", () => {
    const masked = getMaskedConfigSummary(config);
    expect(masked.pikpak.username).not.toBe(config.pikpak.username);
    expect(masked.pikpak.password).not.toBe(config.pikpak.password);
    expect(masked.llm.apiKey).not.toBe(config.llm.apiKey);
  });
});
