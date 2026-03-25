import { describe, expect, test } from "bun:test";
import {
  resolveDevProcessConfig,
  resolveFrontendMode,
} from "../src/dev-runtime";

describe("resolveFrontendMode", () => {
  test("serves static frontend by default", () => {
    expect(resolveFrontendMode({})).toEqual({ type: "static" });
  });

  test("redirects to the Vite dev server when UI_DEV_URL is set", () => {
    expect(
      resolveFrontendMode({ UI_DEV_URL: "http://127.0.0.1:4173" }),
    ).toEqual({
      type: "redirect",
      location: "http://127.0.0.1:4173",
    });
  });
});

describe("resolveDevProcessConfig", () => {
  test("uses fixed local ports and wires backend/frontend urls together", () => {
    expect(resolveDevProcessConfig({})).toEqual({
      backendPort: 3000,
      uiHost: "127.0.0.1",
      uiPort: 4173,
      uiDevUrl: "http://127.0.0.1:4173",
      apiTarget: "http://127.0.0.1:3000",
    });
  });

  test("accepts custom ports from env", () => {
    expect(
      resolveDevProcessConfig({ PORT: "3300", UI_DEV_PORT: "4200" }),
    ).toEqual({
      backendPort: 3300,
      uiHost: "127.0.0.1",
      uiPort: 4200,
      uiDevUrl: "http://127.0.0.1:4200",
      apiTarget: "http://127.0.0.1:3300",
    });
  });
});
