import type { ReactNode } from "react";
import { getConsoleCopy, type ConsoleLocale } from "../lib/console-i18n";

export function StepPage({
  title,
  description,
  actions,
  children,
  locale,
  showAutoSaveNote = true,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  locale: ConsoleLocale;
  showAutoSaveNote?: boolean;
}) {
  const copy = getConsoleCopy(locale);

  return (
    <section className="page-view is-active">
      <div className="page-header">
        <div>
          <span className="page-kicker">{copy.shell.pageKicker}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          {showAutoSaveNote ? (
            <p className="page-note">{copy.common.autoSaveOn}</p>
          ) : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
      <div className="page-stack">{children}</div>
    </section>
  );
}
