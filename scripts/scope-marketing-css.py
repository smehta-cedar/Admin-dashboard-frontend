from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "app" / "marketing.css"
text = path.read_text(encoding="utf-8")

text = text.replace("url('assets/", "url('/assets/")
text = text.replace('url("assets/', 'url("/assets/')

idx = text.find(":root {")
if idx < 0:
    raise SystemExit("no :root")

i = text.find("{", idx)
depth = 0
end = None
for j in range(i, len(text)):
    if text[j] == "{":
        depth += 1
    elif text[j] == "}":
        depth -= 1
        if depth == 0:
            end = j + 1
            break

root = text[:end]
rest = text[end:].lstrip("\n")

rest = rest.replace(
    "*,\n*::before,\n*::after {",
    "&,\n& *,\n& *::before,\n& *::after {",
    1,
)
rest = re.sub(r"^html \{", "& {", rest, count=1, flags=re.M)
rest = re.sub(r"^body \{", "& {", rest, count=1, flags=re.M)

root = root.replace(
    "--font-heading: 'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif;",
    "--font-heading: var(--font-plus-jakarta), 'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif;",
)
root = root.replace(
    "--font-sans: 'DM Sans', 'Segoe UI', system-ui, sans-serif;",
    "--font-sans: var(--font-dm-sans), 'DM Sans', 'Segoe UI', system-ui, sans-serif;",
)
root = root.replace(
    "--font-nav: 'DM Sans', 'Segoe UI', system-ui, sans-serif;",
    "--font-nav: var(--font-dm-sans), 'DM Sans', 'Segoe UI', system-ui, sans-serif;",
)

# Theme helpers so Tailwind utilities used in the HTML resolve
theme_helpers = """
/* Marketing Tailwind color bridges (used by ported markup utilities) */
@theme {
  --color-brand-teal: rgb(var(--rgb-teal));
  --color-brand-teal-green: rgb(var(--rgb-teal-green));
  --color-brand-mid: rgb(var(--rgb-mid));
  --color-brand-lime-green: rgb(var(--rgb-lime-green));
  --color-brand-lime: rgb(var(--rgb-lime));
  --color-brand-teal-deep: rgb(var(--rgb-teal-deep));
  --color-brand-lime-deep: rgb(var(--rgb-lime-deep));
  --color-brand-teal-dark: rgb(var(--rgb-teal-dark));
  --color-brand-lime-dark: rgb(var(--rgb-lime-dark));
  --color-brand-lime-light: rgb(var(--rgb-lime-light));
  --color-brand-teal-tint: rgb(var(--rgb-teal-tint));
  --color-brand-lime-tint: rgb(var(--rgb-lime-tint));
  --color-ink: rgb(var(--rgb-ink));
  --color-ink-soft: rgb(var(--rgb-ink-soft));
  --color-ink-muted: rgb(var(--rgb-ink-muted));
  --max-width-8xl: var(--container-max);
}
"""

scoped = (
    root
    + "\n"
    + theme_helpers
    + "\n/* Scoped to public marketing pages so CRM styles stay intact */\n@scope (.cg-site) {\n"
    + rest
    + "\n}\n"
)

path.write_text(scoped, encoding="utf-8")
print("wrote", path, "bytes", len(scoped))
