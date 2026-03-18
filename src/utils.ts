import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function nowIso() {
  return new Date().toISOString();
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function createDeviceId(seed?: string) {
  return createHash("md5")
    .update(seed || randomUUID())
    .digest("hex");
}

export function md5(input: string) {
  return createHash("md5").update(input).digest("hex");
}

export function extractJsonBlock(text: string) {
  const codeBlock = text.match(/```json\s*([\s\S]*?)```/i);
  if (codeBlock) return codeBlock[1].trim();

  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error("未找到 JSON 内容");
  }

  const start =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);
  return text.slice(start).trim();
}

export async function writeJsonFile(path: string, data: unknown) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
