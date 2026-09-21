import type { ReactNode } from "react";

/*
 * The navbar shows the page's name, so the title here is a visually hidden
 * <h1>; what is left on screen is the description and the actions.
 */

type PageHeaderProps = {
  /** Screen readers and the document outline only. */
  title: string;
  description?: ReactNode;
  /** Lay the description out as a wrapping row (e.g. stats) instead of a paragraph. */
  inlineDescription?: boolean;
  /** Buttons or links shown beside the title; wraps below it on narrow screens. */
  actions?: ReactNode;
};

export function PageHeader({ title, description, inlineDescription = false, actions }: PageHeaderProps) {
  if (!description && !actions) return <h1 className="sr-only">{title}</h1>;

  return (
    <header
      className={`mb-6 flex flex-wrap justify-between gap-4 border-b border-line pb-4 ${
        inlineDescription ? "items-center" : "items-start"
      }`}
    >
      <div className={inlineDescription ? "flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2" : "min-w-0"}>
        <h1 className="sr-only">{title}</h1>
        {description ? (
          inlineDescription ? (
            <div className="text-sm text-fg-muted">{description}</div>
          ) : (
            <p className="text-sm text-fg-muted">{description}</p>
          )
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
