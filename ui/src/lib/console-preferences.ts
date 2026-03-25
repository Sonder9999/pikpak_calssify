import type { ConsolePageId } from "./dashboard-view-model";

export interface PageAutoSaveScope {
  runtime: boolean;
  prompts: boolean;
  categories: boolean;
}

export const THEME_STORAGE_KEY = "pikpak-step-pages-theme";
export const LOCALE_STORAGE_KEY = "pikpak-step-pages-locale";
export const AUTO_SAVE_DELAY_MS = 900;

const EMPTY_SCOPE: PageAutoSaveScope = {
  runtime: false,
  prompts: false,
  categories: false,
};

const PAGE_AUTO_SAVE_SCOPE: Record<ConsolePageId, PageAutoSaveScope> = {
  scan: { runtime: true, prompts: false, categories: false },
  folders: { runtime: true, prompts: true, categories: true },
  classify: { runtime: true, prompts: true, categories: false },
  "dry-run": { runtime: true, prompts: false, categories: false },
  move: { runtime: true, prompts: false, categories: false },
  logs: EMPTY_SCOPE,
};

export function getPageAutoSaveScope(pageId: ConsolePageId): PageAutoSaveScope {
  return PAGE_AUTO_SAVE_SCOPE[pageId] ?? EMPTY_SCOPE;
}

export function hasAutoSaveScope(scope: PageAutoSaveScope) {
  return scope.runtime || scope.prompts || scope.categories;
}
