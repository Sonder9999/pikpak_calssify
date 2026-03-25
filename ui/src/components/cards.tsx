import type { ReactNode } from "react";

export function cx(...tokens: Array<string | false | null | undefined>) {
  return tokens.filter(Boolean).join(" ");
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx("surface-card section-card", className)}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {description ? <p className="section-copy">{description}</p> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      {children}
    </article>
  );
}

export function StatGrid({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    hint?: string;
    tone?: "default" | "warn" | "error" | "success";
  }>;
}) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <div
          key={item.label}
          className={cx(
            "stat-card",
            item.tone ? `tone-${item.tone}` : undefined,
          )}
        >
          <span className="stat-label">{item.label}</span>
          <strong className="stat-value">{item.value}</strong>
          {item.hint ? <span className="stat-hint">{item.hint}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function ActionButton({
  children,
  tone = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      {...props}
      className={cx("action-button", `action-${tone}`, props.className)}
      type={props.type ?? "button"}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("field", className)}>
      <span className="field-label">{label}</span>
      {hint ? <span className="field-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="toggle-card">
      <div>
        <div className="field-label">{label}</div>
        {hint ? <div className="field-hint">{hint}</div> : null}
      </div>
      <button
        className={cx("toggle-switch", checked && "is-on")}
        onClick={() => onChange(!checked)}
        type="button"
      >
        <span />
      </button>
    </div>
  );
}

export function ChipList({
  items,
  emptyText,
}: {
  items: string[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="chip-list">
      {items.map((item) => (
        <span key={item} className="chip">
          {item}
        </span>
      ))}
    </div>
  );
}

export function DataList({
  items,
  emptyText,
}: {
  items: Array<{ title: string; detail?: string; extra?: string }>;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="data-list">
      {items.map((item) => (
        <article key={`${item.title}-${item.detail}`} className="data-item">
          <strong>{item.title}</strong>
          {item.detail ? <p>{item.detail}</p> : null}
          {item.extra ? <span>{item.extra}</span> : null}
        </article>
      ))}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
