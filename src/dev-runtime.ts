export interface FrontendModeStatic {
  type: "static";
}

export interface FrontendModeRedirect {
  type: "redirect";
  location: string;
}

export interface DevProcessConfig {
  backendPort: number;
  uiHost: string;
  uiPort: number;
  uiDevUrl: string;
  apiTarget: string;
}

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveFrontendMode(env: Record<string, string | undefined>):
  | FrontendModeStatic
  | FrontendModeRedirect {
  const location = env.UI_DEV_URL?.trim();
  if (!location) {
    return { type: "static" };
  }

  return {
    type: "redirect",
    location,
  };
}

export function resolveDevProcessConfig(
  env: Record<string, string | undefined>,
): DevProcessConfig {
  const backendPort = parsePort(env.PORT, 3000);
  const uiPort = parsePort(env.UI_DEV_PORT, 4173);
  const uiHost = env.UI_DEV_HOST?.trim() || "127.0.0.1";
  const uiDevUrl = `http://${uiHost}:${uiPort}`;

  return {
    backendPort,
    uiHost,
    uiPort,
    uiDevUrl,
    apiTarget: `http://127.0.0.1:${backendPort}`,
  };
}
