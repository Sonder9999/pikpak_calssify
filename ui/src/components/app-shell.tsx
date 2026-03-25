import type { ReactNode } from "react";
import type {
  ConsolePageId,
  ConsolePageModel,
  ThemePreference,
} from "../lib/dashboard-view-model";
import type { ConsoleLocale } from "../lib/console-i18n";
import { Sidebar } from "./sidebar";

export function AppShell({
  pages,
  activePage,
  onSelectPage,
  theme,
  onToggleTheme,
  locale,
  onToggleLocale,
  children,
}: {
  pages: ConsolePageModel[];
  activePage: ConsolePageId;
  onSelectPage: (page: ConsolePageId) => void;
  theme: ThemePreference;
  onToggleTheme: () => void;
  locale: ConsoleLocale;
  onToggleLocale: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="page-backdrop" />
      <Sidebar
        activePage={activePage}
        locale={locale}
        onSelect={onSelectPage}
        onToggleLocale={onToggleLocale}
        onToggleTheme={onToggleTheme}
        pages={pages}
        theme={theme}
      />
      <div className="app-shell">
        <main className="main-shell">{children}</main>
      </div>
    </>
  );
}
