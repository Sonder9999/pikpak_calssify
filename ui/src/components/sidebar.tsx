import type {
  ConsolePageId,
  ConsolePageModel,
  ThemePreference,
} from "../lib/dashboard-view-model";
import {
  getConsoleCopy,
  type ConsoleLocale,
} from "../lib/console-i18n";
import { cx } from "./cards";

const PAGE_ICONS: Record<ConsolePageId, string> = {
  scan: "SC",
  folders: "FD",
  classify: "CL",
  "dry-run": "DR",
  move: "MV",
  logs: "LG",
};

export function Sidebar({
  pages,
  activePage,
  onSelect,
  theme,
  onToggleTheme,
  locale,
  onToggleLocale,
}: {
  pages: ConsolePageModel[];
  activePage: ConsolePageId;
  onSelect: (page: ConsolePageId) => void;
  theme: ThemePreference;
  onToggleTheme: () => void;
  locale: ConsoleLocale;
  onToggleLocale: () => void;
}) {
  const copy = getConsoleCopy(locale);

  return (
    <div className="nav-safe-zone">
      <div className="nav-hover-zone" aria-hidden="true" />
      <aside className="nav-panel" aria-label={copy.shell.navLabel}>
        <div className="nav-stack nav-main">
          {pages.map((page) => (
            <button
              aria-current={activePage === page.id ? "page" : undefined}
              key={page.id}
              className={cx(
                "nav-icon-button",
                activePage === page.id && "is-active",
                page.stale && "is-stale",
              )}
              onClick={() => onSelect(page.id)}
              type="button"
            >
              <span className="nav-icon-glyph">{PAGE_ICONS[page.id]}</span>
              <span className="nav-tooltip">
                {page.title} · {page.statusLabel}
              </span>
            </button>
          ))}
        </div>

        <div className="nav-divider" />

        <div className="nav-stack nav-utilities">
          <button
            aria-label={
              theme === "dark"
                ? copy.shell.switchToLight
                : copy.shell.switchToDark
            }
            aria-pressed={theme === "dark"}
            className="nav-icon-button utility-button"
            onClick={onToggleTheme}
            title={copy.shell.themeToggle}
            type="button"
          >
            <span className="nav-icon-glyph theme-toggle-icon">
              {theme === "dark" ? copy.shell.darkIcon : copy.shell.lightIcon}
            </span>
            <span className="nav-tooltip">{copy.shell.themeToggle}</span>
          </button>
          <button
            aria-label={
              locale === "zh-CN"
                ? copy.shell.switchToEnglish
                : copy.shell.switchToChinese
            }
            className="nav-icon-button utility-button"
            onClick={onToggleLocale}
            title={copy.shell.languageToggle}
            type="button"
          >
            <span className="nav-icon-glyph language-glyph">
              {copy.shell.languageIcon}
            </span>
            <span className="nav-tooltip">{copy.shell.languageToggle}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
