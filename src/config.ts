import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig, ConfigValidation } from "./types";

function readEnv(name: string, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

function readBoolean(name: string, fallback: boolean) {
  const value = readEnv(name, String(fallback));
  return value === "true" || value === "1";
}

function readNumber(name: string, fallback: number) {
  const value = Number(readEnv(name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

export function loadConfig(): AppConfig {
  return {
    port: readNumber("PORT", 3000),
    pikpak: {
      username: readEnv("PIKPAK_USERNAME"),
      password: readEnv("PIKPAK_PASSWORD"),
      sourceFolder: readEnv("PIKPAK_SOURCE_FOLDER", "Sonder/Blue"),
      targetFolder: readEnv("PIKPAK_TARGET_FOLDER", "Blue"),
      deviceId: readEnv("PIKPAK_DEVICE_ID"),
    },
    llm: {
      apiKey: readEnv("LLM_API_KEY"),
      baseUrl: readEnv("LLM_BASE_URL", "https://api.siliconflow.cn/v1"),
      model: readEnv("LLM_MODEL", "deepseek-ai/DeepSeek-V3.2"),
    },
    workflow: {
      outputDir: readEnv("OUTPUT_DIR", "output"),
      batchSize: readNumber("BATCH_SIZE", 100),
      onlyClassifyVideo: readBoolean("ONLY_CLASSIFY_VIDEO", true),
      enableShortVideoFilter: readBoolean("ENABLE_SHORT_VIDEO_FILTER", true),
      shortVideoThresholdSeconds: readNumber(
        "SHORT_VIDEO_THRESHOLD_SECONDS",
        180,
      ),
      moveBatchSize: readNumber("MOVE_BATCH_SIZE", 20),
      moveMinDelayMs: readNumber("MOVE_MIN_DELAY_MS", 2000),
      moveMaxDelayMs: readNumber("MOVE_MAX_DELAY_MS", 5000),
    },
  };
}

export function validateConfig(config: AppConfig): ConfigValidation {
  const errors: string[] = [];

  if (!config.pikpak.username) errors.push("缺少 PIKPAK_USERNAME");
  if (!config.pikpak.password) errors.push("缺少 PIKPAK_PASSWORD");
  if (!config.pikpak.sourceFolder) errors.push("缺少 PIKPAK_SOURCE_FOLDER");
  if (!config.pikpak.targetFolder) errors.push("缺少 PIKPAK_TARGET_FOLDER");
  if (config.port <= 0) errors.push("PORT 必须大于 0");
  if (config.workflow.batchSize <= 0) errors.push("BATCH_SIZE 必须大于 0");

  return { valid: errors.length === 0, errors };
}

export function validateLlmConfig(config: AppConfig): ConfigValidation {
  const errors: string[] = [];

  if (!config.llm.apiKey) errors.push("缺少 LLM_API_KEY");
  if (!config.llm.baseUrl) errors.push("缺少 LLM_BASE_URL");
  if (!config.llm.model) errors.push("缺少 LLM_MODEL");

  return { valid: errors.length === 0, errors };
}

function mask(value: string) {
  if (!value) return "";
  if (value.length <= 6) return "*".repeat(value.length);
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export function getMaskedConfigSummary(config: AppConfig) {
  return {
    port: config.port,
    pikpak: {
      username: mask(config.pikpak.username),
      password: mask(config.pikpak.password),
      sourceFolder: config.pikpak.sourceFolder,
      targetFolder: config.pikpak.targetFolder,
      deviceId: config.pikpak.deviceId
        ? mask(config.pikpak.deviceId)
        : "自动生成",
    },
    llm: {
      apiKey: mask(config.llm.apiKey),
      baseUrl: config.llm.baseUrl,
      model: config.llm.model,
    },
    workflow: config.workflow,
  };
}

export async function ensureOutputDir(config: AppConfig) {
  await mkdir(join(process.cwd(), config.workflow.outputDir), {
    recursive: true,
  });
}
