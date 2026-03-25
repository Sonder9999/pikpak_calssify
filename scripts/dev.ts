import { resolveDevProcessConfig } from "../src/dev-runtime";

const config = resolveDevProcessConfig(process.env);

const children = [
  Bun.spawn(["bun", "--watch", "src/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(config.backendPort),
      UI_DEV_URL: config.uiDevUrl,
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }),
  Bun.spawn(
    [
      "bun",
      "x",
      "vite",
      "--config",
      "ui/vite.config.ts",
      "--host",
      config.uiHost,
      "--port",
      String(config.uiPort),
      "--strictPort",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_API_TARGET: config.apiTarget,
        VITE_API_BASE_URL: "",
      },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  ),
];

let shuttingDown = false;

async function shutdown(code: number) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    child.kill();
  }

  const settled = children.map((child) => child.exited.catch(() => code));
  await Promise.allSettled(settled);
  process.exit(code);
}

process.on("SIGINT", () => void shutdown(130));
process.on("SIGTERM", () => void shutdown(143));

const firstExit = await Promise.race(
  children.map(async (child, index) => ({
    code: await child.exited,
    index,
  })),
);

await shutdown(firstExit.code ?? 1);
