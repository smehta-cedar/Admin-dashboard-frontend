# Entity page pattern

How the Agents page is built, written as a reference for the next entity pages
(Carriers, Rulebook, Logins, Contracts). Reference implementation:

- [lib/agents.ts](../lib/agents.ts) — types and data access
- [data/agents.json](../data/agents.json), [data/agent-notes.json](../data/agent-notes.json) — fake data
- [app/(dashboard)/agents/page.tsx](../app/(dashboard)/agents/page.tsx) — server page
- [app/(dashboard)/agents/agents-view.tsx](../app/(dashboard)/agents/agents-view.tsx) — client view

Current stage: **view + dummy add/edit, no backend.** Data comes from JSON;
changes live in React state and a refresh throws them away.

---

## 1. Process: agree fields first

1. Write a field table (field, required, type, notes) and agree it before code.
2. Decide what is *not* a column on the entity and belongs in a related list
   (e.g. writing numbers are not on Agent; they go with Logins).
3. Then types → fake JSON → page → add/edit → notes.

## 2. Files and layers

| Layer | File | Rules |
| --- | --- | --- |
| Fake data | `data/<entity>.json`, `data/<entity>-notes.json` | Plain JSON arrays. Fake names, `example.com` emails, `555` phones. |
| Data boundary | `lib/<entity>.ts` | `import "server-only"`. Exports types and `get<Entity>()` / `get<Entity>Notes()`. The only module that knows where data comes from (JSON today, Supabase later). JSON is cast to the type, not validated. |
| Server page | `app/(dashboard)/<entity>/page.tsx` | Server component. `metadata.title`, loads data with `Promise.all`, renders the view. No UI logic. |
| Client view | `app/(dashboard)/<entity>/<entity>-view.tsx` | `"use client"`. Table, expandable rows, add/edit dialog, notes, unsaved banner. Imports **types only** from `lib/<entity>.ts` (`import type`), never functions — that module is server-only. |

Shared pieces (extracted when Carriers landed — use these, don't copy):

| File | Exports |
| --- | --- |
| `components/page-header.tsx` | `PageHeader` (title + `actions` slot) |
| `components/empty-state.tsx` | `EmptyState` (title, description, `action`) |
| `components/field.tsx` | `Field` (label + input + hint/error) |
| `components/note-list.tsx` | `NoteList` (generic; pass `labels={FIELD_LABELS}`) |
| `components/status-badge.tsx` | `StatusBadge` |
| `components/modal-dialog.tsx` | `useModalDialog(open)` → `{ dialogRef, close }`, `ModalDialog` |
| `components/classes.ts` | `INPUT_CLASS`, `PRIMARY_BUTTON_CLASS`, `GHOST_BUTTON_CLASS`, `ROW_BUTTON_CLASS` |
| `lib/change-notes.ts` | `nextId`, `fieldText`, `diffValues(FIELDS, before, after)`, `FieldChange<F>` |

Constants a client view needs from an entity (like `LINES_OF_BUSINESS`) go in
a separate client-safe module such as `lib/lines-of-business.ts`, not in the
server-only entity module.

## 3. Data conventions

- **Primary key:** internal `id: string`, numbered `"1"`, `"2"`, `"3"`… for now.
  Never a business number (NPN, writing number, carrier code) as the PK.
- **Ordering:** `get<Entity>()` returns rows in ID order (numeric sort).
- **New IDs:** `nextId(items)` = highest ID + 1, so lists stay 1…n.
- **Required vs optional:** required fields are plain `string`; optional ones
  are `?:`. Lists (like `aliases`) are `string[]`, empty when none — not optional.
- **Status:** string union (`"active" | "inactive"`), default `"active"` on add.
- **Uniqueness rules** (e.g. NPN) are enforced in the form for now.
- **Existing slim types stay slim.** The commission matrix keeps
  `Agent = { id, name }` in `lib/commissions.ts`; richer records go in the
  entity module.

## 4. Change notes (audit log)

Every add and every edit writes a note automatically. Notes are append-only.

```ts
type <Entity>Field = Exclude<keyof <Entity>Record, "id">;

type <Entity>Change = { field: <Entity>Field; from: string; to: string };

type <Entity>Note = {
  id: string;
  <entity>Id: string;
  kind: "added" | "edited";
  createdAt: string;       // ISO 8601 UTC, "2026-09-02T14:05:00.000Z"
  changes: <Entity>Change[]; // only changed fields, in form order
};
```

- `from`/`to` are **display strings** (arrays joined with `", "`).
- **Add** → `kind: "added"`, diff against empty values (only filled fields recorded).
- **Edit** → `kind: "edited"`, diff against the record as it was when the dialog opened.
- **Nothing changed** → close the dialog, no note, no banner count.
- `FIELD_LABELS: Record<Field, string>` gives labels **and** the order changes are compared and listed in.
- Notes list newest first (`get…Notes()` sorts desc; new notes are prepended).
- Display: header `Added · Sep 2, 2026, 9:05 AM` (`toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })` inside `<time dateTime>`), then one line per change:
  - added: `Name: Denise Washington`
  - edited: `Phone: 555-010-4400 → 555-010-4410` (arrow `aria-hidden`, sr-only "changed to"; blanks show `(empty)`)
- Timestamps render only inside expanded rows (client state, closed on first
  render), which avoids server/client timezone hydration mismatches. Keep it
  that way or format dates on one side only.
- Not yet: author (no auth), free-text notes/reasons.

## 5. Page layout

```
PageHeader  title="<Entities>"  actions=[Add <entity>]
Unsaved banner (role="status", only when changes > 0)
Table  — or EmptyState with the same Add button when the list is empty
<dialog> add/edit form
```

## 6. Table

- Wrapper: `overflow-x-auto rounded-lg border border-gray-200`;
  table `min-w-full text-left text-sm`.
- Head: `bg-gray-50`; `th scope="col"`, `whitespace-nowrap px-4 py-2.5 font-medium text-gray-600`.
- Body: `divide-y divide-gray-200 border-t border-gray-200`; cells `px-4 py-2.5`.
- Column order used on Agents: **ID, NPN, Name, Status, Email, Phone, [actions]**.
  Keep columns in a `COLUMNS` array; the actions column has an sr-only "Actions" header.
- IDs and codes: `font-mono text-gray-600`. Secondary text: `text-gray-600`.
  Primary name: `text-gray-900`, `whitespace-nowrap`.
- Status badge: `rounded-md px-2 py-0.5 text-xs font-medium capitalize` +
  `active: bg-green-50 text-green-700`, `inactive: bg-gray-100 text-gray-600`.
- Row action: text button `Edit` with sr-only entity name
  (`Edit<span className="sr-only"> {name}</span>`), right-aligned.
- Secondary/list data (aliases, notes) does **not** go in the main row — see §7.

## 7. Expandable row (name dropdown)

- The name cell is a `<button>`: name, then a chevron (`M8 5l5 5-5 5`) that
  rotates 90° when open. `aria-expanded`, and `aria-controls` pointing at the
  details row while it is open.
- Open state: `Set<string>` of IDs; several rows can be open; all start closed.
- Open parent row and details row both get `bg-gray-50`.
- Details row: one `<td colSpan={COLUMNS.length + 1} className="px-4 pb-4 pt-1">`
  with a grid `sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]` (stacks on mobile).
- Sections inside: small heading
  `text-xs font-semibold uppercase tracking-wide text-gray-500`, then content.
  Agents shows **Aliases** (one per line, or "None") and **Notes**
  (cards: `rounded-md border border-gray-200 bg-white px-3 py-2`, or
  "No changes recorded yet.").
- Wrap each pair of rows in `<Fragment key={id}>`.

## 8. Add / edit dialog

- One native `<dialog>` for both modes, state
  `type Editor = { mode: "add" } | { mode: "edit"; record }`.
- Open by setting the editor; an effect calls `showModal()` after render. The
  form renders only while the editor is set, so closing (Cancel, Escape,
  backdrop click, save) clears the editor in `onClose` and unmounts/resets the form.
- Backdrop click closes (`event.target === event.currentTarget`; the form fills the dialog).
- Classes: `m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-white p-0 shadow-xl backdrop:bg-gray-900/40`
  (`m-auto` is needed because Tailwind preflight zeroes dialog margins).
- Content: `h2` title (`Add <entity>` / `Edit <name>`), one-line description
  saying it is not saved anywhere, fields grid `mt-5 grid gap-4 sm:grid-cols-2`
  (wide fields `sm:col-span-2`), footer `mt-6 flex justify-end gap-2` with
  Cancel (ghost) and submit (`Add <entity>` / `Save changes`).
- Form handling: uncontrolled inputs with `defaultValue` from the record;
  `onSubmit` → `preventDefault` → `FormData` → trim every value → build the values object.
- Validation:
  - `required` on required fields, plus `pattern=".*\S.*"` so spaces-only fails
    (not needed on `type="email"`).
  - Optional fields: label suffix `(optional)` via `Field optional`.
  - Comma lists: one text input with hint "…separated by commas", split + trim + drop blanks.
  - Uniqueness: check in `onSubmit`, excluding the record being edited; show
    the error under the field (`aria-invalid`, `aria-describedby`), clear it on change.
    Message names the conflicting record ("NPN 123 already belongs to Maria Alvarez.").
- `Field` helper: label + input + optional hint/error text (`text-red-700` for errors).
- Inputs: `type="email"`, `type="tel"`, `inputMode="numeric"` for number-like
  IDs (still stored as strings), `autoComplete="off"`.

## 9. Unsaved banner

`<div role="status">` always rendered; inside, when count > 0:
`mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800` —
"N changes made on this page only. Nothing is saved yet, so refreshing undoes them."
Count increments on every add and every edit that changed something.

## 10. Style tokens

| Use | Classes |
| --- | --- |
| Primary button | `rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700` |
| Ghost button | `rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100` |
| Row text button | `rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100` |
| Input / select | `mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 aria-invalid:border-red-600` |
| Label | `block text-sm font-medium text-gray-900` |
| Hint / error | `mt-1 text-xs text-gray-500` / `text-red-700` |
| Warning banner | `rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800` |

Palette is Tailwind grays with green (active), amber (warning), red (error).

## 11. Accessibility checklist

- `th scope="col"`; sr-only header for the actions column.
- Toggle buttons use `aria-expanded` / `aria-controls`.
- Icon SVGs are `aria-hidden`; icon meaning comes from text or sr-only text.
- Dialog `aria-labelledby` its title; native `<dialog>` handles focus trap,
  Escape, and focus return.
- Field errors: `aria-invalid` + `aria-describedby`.
- Banner lives in a persistent `role="status"` region.

## 12. New entity page checklist

1. Agree the field table (and what moves to a related list).
2. `lib/<entity>.ts`: `server-only`, `<Entity>Record`, status union, `Field`,
   `Change`, `Note` types, `get<Entity>()`, `get<Entity>Notes()`.
3. `data/<entity>.json` (IDs 1…n, cover edge cases: inactive, empty lists) and
   `data/<entity>-notes.json` (a few added/edited samples).
4. `page.tsx`: metadata, `Promise.all`, render the view.
5. `<entity>-view.tsx`: copy the Agents structure — `COLUMNS`, `FIELD_LABELS`,
   table, expandable row for list/secondary data + notes, add/edit dialog,
   diff → note, unsaved banner.
6. `npm run typecheck` and `next build`, then click through add, edit (no-op
   and real change), duplicate check, expand/collapse, Escape/backdrop close.

## 13. Shared helpers

Extracted when Carriers became the second page; see the table in §2. Still
copied per view (small, and may diverge): the name toggle button with
chevron, the unsaved banner, and the aliases section.

Carriers ([app/(dashboard)/carriers/carriers-view.tsx](../app/(dashboard)/carriers/carriers-view.tsx))
adds two variations on the Agents form: a required checkbox group
(`<fieldset>` + `<legend>`, "at least one" checked in `onSubmit`, error on
each checkbox via `aria-invalid`/`aria-describedby`), and a name uniqueness
check against other carriers' names *and* aliases, ignoring case.
