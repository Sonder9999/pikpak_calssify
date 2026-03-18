import { createHash } from "node:crypto";
import type { AppConfig, FileEntry, PikPakFileApiItem } from "../types";
import { createDeviceId, md5, uniqueStrings } from "../utils";

const CLIENT_ID = "YNxT9w7GMdWvEOKa";
const CLIENT_SECRET = "dbw2OtmVEeuUvIptb1Coyg";
const CLIENT_VERSION = "1.47.1";
const PACKAGE_NAME = "com.pikcloud.pikpak";
const SDK_VERSION = "2.0.4.204000";
const USER_HOST = "https://user.mypikpak.com";
const API_HOST = "https://api-drive.mypikpak.com";

const SALTS = [
  "Gez0T9ijiI9WCeTsKSg3SMlx",
  "zQdbalsolyb1R/",
  "ftOjr52zt51JD68C3s",
  "yeOBMH0JkbQdEFNNwQ0RI9T3wU/v",
  "BRJrQZiTQ65WtMvwO",
  "je8fqxKPdQVJiy1DM6Bc9Nb1",
  "niV",
  "9hFCW2R1",
  "sHKHpe2i96",
  "p7c5E6AcXQ/IJUuAEC9W6",
  "",
  "aRv9hjc9P+Pbn+u3krN6",
  "BzStcgE8qVdqjEH16l4",
  "SqgeZvL5j9zoHP95xWHt",
  "zVof5yaJkPe3VFpadPof",
];

function timestamp() {
  return Date.now().toString();
}

function captchaSign(deviceId: string, now: string) {
  let sign = `${CLIENT_ID}${CLIENT_VERSION}${PACKAGE_NAME}${deviceId}${now}`;
  for (const salt of SALTS) sign = md5(`${sign}${salt}`);
  return `1.${sign}`;
}

function deviceSign(deviceId: string) {
  const signatureBase = `${deviceId}${PACKAGE_NAME}1appkey`;
  const sha1Result = createHash("sha1").update(signatureBase).digest("hex");
  return `div101.${deviceId}${md5(sha1Result)}`;
}

export class PikPakClient {
  private accessToken = "";
  private refreshToken = "";
  private userId = "";
  private captchaToken = "";
  private pathCache = new Map<
    string,
    { id: string; name: string; fileType: "folder" | "file" }
  >();
  private readonly deviceId: string;

  constructor(
    private readonly config: AppConfig,
    private readonly signal?: AbortSignal,
  ) {
    this.deviceId =
      config.pikpak.deviceId ||
      createDeviceId(`${config.pikpak.username}${config.pikpak.password}`);
  }

  private buildUserAgent() {
    const sign = deviceSign(this.deviceId);
    return [
      `ANDROID-${PACKAGE_NAME}/${CLIENT_VERSION}`,
      "protocolVersion/200",
      "accesstype/",
      `clientid/${CLIENT_ID}`,
      `clientversion/${CLIENT_VERSION}`,
      "action_type/",
      "networktype/WIFI",
      "sessionid/",
      `deviceid/${this.deviceId}`,
      "providername/NONE",
      `devicesign/${sign}`,
      "refresh_token/",
      `sdkversion/${SDK_VERSION}`,
      `datetime/${Date.now()}`,
      `usrno/${this.userId}`,
      `appname/${PACKAGE_NAME}`,
      "session_origin/",
      "grant_type/",
      "appid/",
      "clientip/",
      "devicename/Xiaomi_M2004J7AC",
      "osversion/13",
      "platformversion/10",
      "accessmode/",
      "devicemodel/M2004J7AC",
    ].join(" ");
  }

  private headers(extra: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": this.captchaToken
        ? this.buildUserAgent()
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "X-Device-Id": this.deviceId,
      ...extra,
    };
    if (this.captchaToken) headers["X-Captcha-Token"] = this.captchaToken;
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    return headers;
  }

  private async request<T>(
    url: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const response = await fetch(url, {
      ...init,
      proxy: this.config.network.proxyUrl,
      signal: init.signal ?? this.signal,
      headers: {
        ...this.headers(),
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (response.ok && !data.error) return data as T;
    if (data.error_code === 16 && retry) {
      await this.refreshAccessToken();
      return this.request<T>(url, init, false);
    }
    throw new Error(
      String(
        data.error_description ||
          data.error ||
          response.statusText ||
          "PikPak 请求失败",
      ),
    );
  }

  private async requestForm<T>(url: string, body: URLSearchParams): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      proxy: this.config.network.proxyUrl,
      signal: this.signal,
      headers: this.headers({
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body,
    });
    const data = (await response.json()) as T & {
      error?: string;
      error_description?: string;
    };
    if (!response.ok || (data as { error?: string }).error) {
      throw new Error(
        (data as { error_description?: string }).error_description ||
          "PikPak 登录失败",
      );
    }
    return data;
  }

  async login() {
    const loginUrl = `${USER_HOST}/v1/auth/signin`;
    const now = timestamp();
    const meta: Record<string, string> = {
      captcha_sign: captchaSign(this.deviceId, now),
      client_version: CLIENT_VERSION,
      package_name: PACKAGE_NAME,
      timestamp: now,
    };
    if (this.config.pikpak.username.includes("@"))
      meta.email = this.config.pikpak.username;
    else meta.username = this.config.pikpak.username;

    const captchaData = await this.request<{ captcha_token: string }>(
      `${USER_HOST}/v1/shield/captcha/init`,
      {
        method: "POST",
        body: JSON.stringify({
          client_id: CLIENT_ID,
          action: `POST:${loginUrl}`,
          device_id: this.deviceId,
          meta,
        }),
      },
    );
    this.captchaToken = captchaData.captcha_token;

    const loginData = await this.requestForm<{
      access_token: string;
      refresh_token: string;
      sub: string;
    }>(
      loginUrl,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: this.config.pikpak.username,
        password: this.config.pikpak.password,
        captcha_token: this.captchaToken,
      }),
    );
    this.accessToken = loginData.access_token;
    this.refreshToken = loginData.refresh_token;
    this.userId = loginData.sub;
  }

  private async refreshAccessToken() {
    const data = await this.request<{
      access_token: string;
      refresh_token: string;
      sub: string;
    }>(
      `${USER_HOST}/v1/auth/token`,
      {
        method: "POST",
        body: JSON.stringify({
          client_id: CLIENT_ID,
          refresh_token: this.refreshToken,
          grant_type: "refresh_token",
        }),
      },
      false,
    );
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.userId = data.sub;
  }

  async listFiles(parentId?: string, pageToken?: string) {
    const url = new URL(`${API_HOST}/drive/v1/files`);
    url.searchParams.set("thumbnail_size", "SIZE_MEDIUM");
    url.searchParams.set("limit", "200");
    url.searchParams.set("with_audit", "true");
    url.searchParams.set(
      "filters",
      JSON.stringify({
        trashed: { eq: false },
        phase: { eq: "PHASE_TYPE_COMPLETE" },
      }),
    );
    if (parentId) url.searchParams.set("parent_id", parentId);
    if (pageToken) url.searchParams.set("page_token", pageToken);
    return this.request<{
      files: PikPakFileApiItem[];
      next_page_token?: string;
    }>(url.toString(), { method: "GET" });
  }

  async createFolder(name: string, parentId?: string) {
    return this.request<{ file: { id: string } }>(
      `${API_HOST}/drive/v1/files`,
      {
        method: "POST",
        body: JSON.stringify({
          kind: "drive#folder",
          name,
          parent_id: parentId,
        }),
      },
    );
  }

  async pathToId(path: string, create = false) {
    const normalized = path.split("/").filter(Boolean);
    const pathIds: Array<{
      id: string;
      name: string;
      fileType: "folder" | "file";
    }> = [];
    let parentId: string | undefined;

    for (let index = 0; index < normalized.length; index += 1) {
      const name = normalized[index]!;
      const currentPath = `/${normalized.slice(0, index + 1).join("/")}`;
      const cached = this.pathCache.get(currentPath);
      if (cached) {
        pathIds.push(cached);
        parentId = cached.id;
        continue;
      }

      let pageToken: string | undefined;
      let found:
        | { id: string; name: string; fileType: "folder" | "file" }
        | undefined;
      do {
        const data = await this.listFiles(parentId, pageToken);
        for (const file of data.files || []) {
          const record = {
            id: file.id,
            name: file.name,
            fileType: file.kind?.includes("folder") ? "folder" : "file",
          } as const;
          this.pathCache.set(
            `/${normalized.slice(0, index).concat(file.name).join("/")}`,
            record,
          );
          if (file.name === name) found = record;
        }
        pageToken = data.next_page_token;
      } while (!found && pageToken);

      if (!found && create) {
        const created = await this.createFolder(name, parentId);
        found = { id: created.file.id, name, fileType: "folder" };
      }
      if (!found) break;

      this.pathCache.set(currentPath, found);
      pathIds.push(found);
      parentId = found.id;
    }

    return pathIds;
  }

  async listFirstLevelFolders(path: string) {
    const pathIds = await this.pathToId(path, false);
    const target = pathIds.at(-1);
    if (!target) throw new Error(`找不到目标目录：${path}`);

    let pageToken: string | undefined;
    const folderNames: string[] = [];
    do {
      const data = await this.listFiles(target.id, pageToken);
      for (const file of data.files || []) {
        if (file.kind?.includes("folder")) folderNames.push(file.name);
      }
      pageToken = data.next_page_token;
    } while (pageToken);

    return uniqueStrings(folderNames).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  async batchMove(ids: string[], toParentId?: string) {
    return this.request(`${API_HOST}/drive/v1/files:batchMove`, {
      method: "POST",
      body: JSON.stringify({
        ids,
        to: toParentId ? { parent_id: toParentId } : {},
      }),
    });
  }

  async scanSourceFolder(): Promise<FileEntry[]> {
    const sourceIds = await this.pathToId(
      this.config.pikpak.sourceFolder,
      false,
    );
    const root = sourceIds.at(-1);
    if (!root)
      throw new Error(`找不到源目录：${this.config.pikpak.sourceFolder}`);

    const results: FileEntry[] = [];
    const walk = async (parentId: string, prefix: string) => {
      let pageToken: string | undefined;
      do {
        const data = await this.listFiles(parentId, pageToken);
        for (const file of data.files || []) {
          const currentPath = prefix ? `${prefix}/${file.name}` : file.name;
          if (file.kind?.includes("folder")) {
            await walk(file.id, currentPath);
          } else {
            const mimeType = file.mime_type || "application/octet-stream";
            results.push({
              id: file.id,
              path: currentPath,
              name: file.name,
              size: Number(file.size || 0),
              mimeType,
              durationSeconds: Number(
                file.video?.duration || file.media?.duration || 0,
              ),
              isVideo: mimeType.startsWith("video/"),
            });
          }
        }
        pageToken = data.next_page_token;
      } while (pageToken);
    };

    await walk(root.id, "");
    return results;
  }
}
