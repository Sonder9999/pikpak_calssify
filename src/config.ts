import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  AppConfig,
  ConfigValidation,
  RuntimeSettingsPayload,
} from "./types";

export const ENV_KEY_ORDER = [
  "PORT",
  "PROXY_URL",
  "PIKPAK_USERNAME",
  "PIKPAK_PASSWORD",
  "PIKPAK_SOURCE_FOLDER",
  "PIKPAK_TARGET_FOLDER",
  "PIKPAK_DEVICE_ID",
  "LLM_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "OUTPUT_DIR",
  "BATCH_SIZE",
  "ONLY_CLASSIFY_VIDEO",
  "ENABLE_SHORT_VIDEO_FILTER",
  "SHORT_VIDEO_THRESHOLD_SECONDS",
  "MOVE_BATCH_SIZE",
  "MOVE_MIN_DELAY_MS",
  "MOVE_MAX_DELAY_MS",
] as const;

type EnvMap = Record<string, string>;

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseEnvText(text: string): EnvMap {
  const values: EnvMap = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    values[key] = value;
  }
  return values;
}

export function serializeEnvMap(values: EnvMap) {
  return `${ENV_KEY_ORDER.map((key) => `${key}=${values[key] ?? ""}`).join("\n")}\n`;
}

export function loadConfigFromEnvMap(values: EnvMap): AppConfig {
  return {
    port: readNumber(values.PORT, 3000),
    network: {
      proxyUrl: values.PROXY_URL?.trim() || undefined,
    },
    pikpak: {
      username: values.PIKPAK_USERNAME?.trim() ?? "",
      password: values.PIKPAK_PASSWORD?.trim() ?? "",
      sourceFolder: values.PIKPAK_SOURCE_FOLDER?.trim() ?? "Blue",
      targetFolder: values.PIKPAK_TARGET_FOLDER?.trim() ?? "Blue",
      deviceId: values.PIKPAK_DEVICE_ID?.trim() || undefined,
    },
    llm: {
      apiKey: values.LLM_API_KEY?.trim() ?? "",
      baseUrl: values.LLM_BASE_URL?.trim() ?? "https://api.siliconflow.cn/v1",
      model: values.LLM_MODEL?.trim() ?? "deepseek-ai/DeepSeek-V3.2",
    },
    workflow: {
      outputDir: values.OUTPUT_DIR?.trim() ?? "output",
      batchSize: readNumber(values.BATCH_SIZE, 100),
      onlyClassifyVideo: readBoolean(values.ONLY_CLASSIFY_VIDEO, true),
      enableShortVideoFilter: readBoolean(
        values.ENABLE_SHORT_VIDEO_FILTER,
        true,
      ),
      shortVideoThresholdSeconds: readNumber(
        values.SHORT_VIDEO_THRESHOLD_SECONDS,
        180,
      ),
      moveBatchSize: readNumber(values.MOVE_BATCH_SIZE, 20),
      moveMinDelayMs: readNumber(values.MOVE_MIN_DELAY_MS, 2000),
      moveMaxDelayMs: readNumber(values.MOVE_MAX_DELAY_MS, 5000),
    },
  };
}

export function runtimeSettingsToEnvMap(
  settings: RuntimeSettingsPayload & { port?: number },
): EnvMap {
  return {
    PORT: String(settings.port ?? 3000),
    PROXY_URL: settings.network?.proxyUrl ?? "",
    PIKPAK_USERNAME: settings.pikpak.username,
    PIKPAK_PASSWORD: settings.pikpak.password,
    PIKPAK_SOURCE_FOLDER: settings.pikpak.sourceFolder,
    PIKPAK_TARGET_FOLDER: settings.pikpak.targetFolder,
    PIKPAK_DEVICE_ID: settings.pikpak.deviceId ?? "",
    LLM_API_KEY: settings.llm.apiKey,
    LLM_BASE_URL: settings.llm.baseUrl,
    LLM_MODEL: settings.llm.model,
    OUTPUT_DIR: settings.workflow.outputDir,
    BATCH_SIZE: String(settings.workflow.batchSize),
    ONLY_CLASSIFY_VIDEO: String(settings.workflow.onlyClassifyVideo),
    ENABLE_SHORT_VIDEO_FILTER: String(settings.workflow.enableShortVideoFilter),
    SHORT_VIDEO_THRESHOLD_SECONDS: String(
      settings.workflow.shortVideoThresholdSeconds,
    ),
    MOVE_BATCH_SIZE: String(settings.workflow.moveBatchSize),
    MOVE_MIN_DELAY_MS: String(settings.workflow.moveMinDelayMs),
    MOVE_MAX_DELAY_MS: String(settings.workflow.moveMaxDelayMs),
  };
}

export function loadConfig(): AppConfig {
  return loadConfigFromEnvMap(process.env as EnvMap);
}

export function validateConfig(config: AppConfig): ConfigValidation {
  const errors: string[] = [];
  if (!config.pikpak.username) errors.push("缺少 PIKPAK_USERNAME");
  if (!config.pikpak.password) errors.push("缺少 PIKPAK_PASSWORD");
  if (!config.pikpak.sourceFolder) errors.push("缺少 PIKPAK_SOURCE_FOLDER");
  if (!config.pikpak.targetFolder) errors.push("缺少 PIKPAK_TARGET_FOLDER");
  if (config.workflow.batchSize <= 0) errors.push("BATCH_SIZE 必须大于 0");
  if (config.workflow.moveBatchSize <= 0)
    errors.push("MOVE_BATCH_SIZE 必须大于 0");
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
  const proxyUrl = config.network.proxyUrl || "未配置";
  return {
    port: config.port,
    network: {
      enabled: Boolean(config.network.proxyUrl),
      label: config.network.proxyUrl ? "已启用" : "未启用",
      proxyUrl,
    },
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
