import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Show the description on the title's row (e.g. stats) instead of under it. */
  inlineDescription?: boolean;
  /** Buttons or links shown beside the title; wraps below it on narrow screens. */
  actions?: ReactNode;
};

export function PageHeader({ title, description, inlineDescription = false, actions }: PageHeaderProps) {
  return (
    <header
      className={`mb-6 flex flex-wrap justify-between gap-4 border-b border-line pb-4 ${
        inlineDescription ? "items-center" : "items-start"
      }`}
    >
      <div className={inlineDescription ? "flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2" : "min-w-0"}>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? (
          inlineDescription ? (
            <div className="text-sm text-fg-muted">{description}</div>
          ) : (
            <p className="mt-1 text-sm text-fg-muted">{description}</p>
          )
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
