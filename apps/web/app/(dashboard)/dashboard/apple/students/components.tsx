import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="a4-page-header"><div>{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="a4-page-actions">{actions}</div>}</header>;
}

export function LoadingState({ text = "正在加载…" }: { text?: string }) {
  return <section className="a4-state" aria-live="polite"><span className="a4-spinner" />{text}</section>;
}

export function EmptyState({ text }: { text: string }) {
  return <section className="a4-state">{text}</section>;
}
