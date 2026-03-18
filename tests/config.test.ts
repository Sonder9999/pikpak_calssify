import { describe, expect, test } from "bun:test";
import {
  getMaskedConfigSummary,
  loadConfigFromEnvMap,
  parseEnvText,
  runtimeSettingsToEnvMap,
  serializeEnvMap,
  validateConfig,
  validateLlmConfig,
} from "../src/config";

describe("config", () => {
  test("parses and serializes env maps", () => {
    const envText = "PIKPAK_USERNAME=user@example.com\nPIKPAK_PASSWORD=secret\nPIKPAK_SOURCE_FOLDER=Media\nPIKPAK_TARGET_FOLDER=Archive\nLLM_API_KEY=abc\n";
    const parsed = parseEnvText(envText);
    expect(parsed.PIKPAK_USERNAME).toBe("user@example.com");
    expect(serializeEnvMap(runtimeSettingsToEnvMap(loadConfigFromEnvMap(parsed)))).toContain("PIKPAK_TARGET_FOLDER=Archive");
  });

  test("validates required runtime config", () => {
    const config = loadConfigFromEnvMap({
      PIKPAK_USERNAME: "user@example.com",
      PIKPAK_PASSWORD: "secret",
      PIKPAK_SOURCE_FOLDER: "Media",
      PIKPAK_TARGET_FOLDER: "Archive",
      LLM_API_KEY: "demo-key",
      LLM_BASE_URL: "https://example.com/v1",
      LLM_MODEL: "demo-model",
    });
    expect(validateConfig(config).valid).toBe(true);
    expect(validateLlmConfig(config).valid).toBe(true);
  });

  test("masks secrets in summary", () => {
    const config = loadConfigFromEnvMap({
      PIKPAK_USERNAME: "user@example.com",
      PIKPAK_PASSWORD: "super-secret",
      PIKPAK_SOURCE_FOLDER: "Media",
      PIKPAK_TARGET_FOLDER: "Archive",
      LLM_API_KEY: "sk-demo-secret",
      LLM_BASE_URL: "https://example.com/v1",
      LLM_MODEL: "demo-model",
    });
    const masked = getMaskedConfigSummary(config);
    expect(masked.pikpak.username).not.toBe(config.pikpak.username);
    expect(masked.pikpak.password).not.toBe(config.pikpak.password);
    expect(masked.llm.apiKey).not.toBe(config.llm.apiKey);
  });

  test("includes proxy status in summary", () => {
    const config = loadConfigFromEnvMap({
      PROXY_URL: "http://127.0.0.1:7890",
      PIKPAK_USERNAME: "user@example.com",
      PIKPAK_PASSWORD: "super-secret",
      PIKPAK_SOURCE_FOLDER: "Media",
      PIKPAK_TARGET_FOLDER: "Archive",
      LLM_API_KEY: "sk-demo-secret",
      LLM_BASE_URL: "https://example.com/v1",
      LLM_MODEL: "demo-model",
    });
    const masked = getMaskedConfigSummary(config);
    expect(masked.network.enabled).toBe(true);
    expect(masked.network.label).toBe("已启用");
    expect(masked.network.proxyUrl).toBe("http://127.0.0.1:7890");
  });
});
