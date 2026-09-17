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
| `components/data-table.tsx` | `DataTable`, `DataTableColumn<T>`, `DataTableRowContext` (sort + search + expandable rows, §6) |
| `components/status-badge.tsx` | `StatusBadge`, `statusRank` (sort order: active, pending, inactive) |
| `components/modal-dialog.tsx` | `useModalDialog(open)` → `{ dialogRef, close }`, `ModalDialog` |
| `components/classes.ts` | `INPUT_CLASS`, `PRIMARY_BUTTON_CLASS`, `GHOST_BUTTON_CLASS`, `ROW_BUTTON_CLASS`, `TOOLBAR_INPUT_CLASS` |
| `lib/change-notes.ts` | `nextId`, `fieldText`, `diffValues(FIELDS, before, after, redact?)`, `FieldChange<F>` |

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

Every entity list renders through `DataTable` (`components/data-table.tsx`).
It uses TanStack Table v9 (`@tanstack/react-table`) for sorting and filtering
only; the markup and classes are ours. v9's API is not v8's: `useTable` +
`tableFeatures`, not `useReactTable` + `getCoreRowModel`. Read the skills in
`node_modules/@tanstack/react-table/skills/` before changing it.

```tsx
<DataTable
  rows={agents}            // current client state; adds/edits show at once
  columns={columns}        // DataTableColumn<T>[], stable (module const or useMemo)
  getRowId={(agent) => agent.id}
  unit={["agent", "agents"]}
  searchPlaceholder="Search name, NPN, email…"
  emptyMessage="No logins for Humana."   // optional; rows empty, no search
  renderDetails={(agent) => …}           // optional; see §7
/>
```

A column: `{ id, header, cell(row, ctx), className?, sortValue?, searchText?, srOnlyHeader? }`.

- **Sort:** a column with `sortValue` gets a header button. Clicks cycle
  ascending → descending → the order `rows` came in (so the view's default
  order, e.g. ID order or Logins' agent-then-carrier, is the "cleared" state).
  One column at a time. Numbers compare numerically (`Number(id)`, counts);
  text ignores case and sorts "2" before "10". Status columns sort by
  `statusRank`. The sorted `th` gets `aria-sort`; the arrow icon is `aria-hidden`.
- **Search:** one box above the table (sr-only label "Search <plural>",
  Escape clears). Every word typed must appear in the row's combined
  `searchText` across columns, ignoring case, so "maria humana" works. Include
  aliases (Agents, Carriers) and state names (Contracts by state). **Never** give a
  password column `searchText` or `sortValue`.
- **Count:** beside the search, `aria-live="polite"`: "12 agents", or
  "3 of 12 agents" while searching.
- **No match:** one row, "No agents match “foo”." with a Clear search button.
  `EmptyState` is still used by the view when the list itself is empty.
- **Filters that live in the URL** (Logins' carrier) stay in the view and
  narrow `rows` before they reach `DataTable`; `TOOLBAR_INPUT_CLASS` styles them.
- Actions column: `{ id: "actions", header: "Actions", srOnlyHeader: true, className: "text-right" }`.
  When it needs `setEditor`, build `columns` with `useMemo` in the view
  (spread a module-level `COLUMNS` for the rest if it helps).
- Out of scope for now: server-side pagination/filtering, in-cell editing, CSV export.

Styling (inside `DataTable`):

- Wrapper: `overflow-x-auto rounded-lg border border-line`;
  table `min-w-full text-left text-sm`.
- Head: `bg-surface-muted`; `th scope="col"`, `whitespace-nowrap px-4 py-2.5 font-medium text-fg-muted`.
- Body: `divide-y divide-line border-t border-line`; cells `px-4 py-2.5` + column `className`.
- Column order used on Agents: **ID, NPN, Name, Status, Email, Phone, [actions]**.
- IDs and codes: `font-mono text-fg-muted`. Secondary text: `text-fg-muted`.
  Primary name: `text-fg`, `whitespace-nowrap`.
- Status badge: `rounded-md px-2 py-0.5 text-xs font-medium capitalize` +
  `active: bg-brand-soft text-brand-ink`, `inactive: bg-surface-hover text-fg-muted`
  (and `pending: bg-warn-soft text-warn-ink`, used only by Logins).
- Row action: text button `Edit` with sr-only entity name
  (`Edit<span className="sr-only"> {name}</span>`), right-aligned.
- Secondary/list data (aliases, notes) does **not** go in the main row — see §7.

Profile pages' small related tables stay plain `<table>`s for now.

## 7. Expandable row (name dropdown)

- `DataTable` owns the open state (a `Set` of row IDs; several rows can be
  open; all start closed; a search or sort keeps them open). It passes each
  cell `ctx = { expanded, toggleExpanded, detailsId }`.
- The name cell renders the toggle `<button>`: name (or a profile link plus a
  separate chevron button with `aria-label="Details for <name>"`), chevron
  (`M8 5l5 5-5 5`) that rotates 90° when open. `aria-expanded={ctx.expanded}`,
  `aria-controls={ctx.expanded ? ctx.detailsId : undefined}`.
- Open parent row and details row both get `bg-surface-muted`.
- `renderDetails(row)` fills one full-width `<td className="px-4 pb-4 pt-1">`; use
  a grid `sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]` (stacks on mobile).
- Sections inside: small heading
  `text-xs font-semibold uppercase tracking-wide text-fg-subtle`, then content.
  Agents shows **Aliases** (one per line, or "None") and **Notes**
  (cards: `rounded-md border border-line bg-surface px-3 py-2`, or
  "No changes recorded yet.").

## 8. Add / edit dialog

- One native `<dialog>` for both modes, state
  `type Editor = { mode: "add" } | { mode: "edit"; record }`.
- Open by setting the editor; an effect calls `showModal()` after render. The
  form renders only while the editor is set, so closing (Cancel, Escape,
  backdrop click, save) clears the editor in `onClose` and unmounts/resets the form.
- Backdrop click closes (`event.target === event.currentTarget`; the form fills the dialog).
- Classes: `m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-surface p-0 shadow-xl backdrop:bg-scrim`
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
- `Field` helper: label + input + optional hint/error text (`text-danger` for errors).
- Inputs: `type="email"`, `type="tel"`, `inputMode="numeric"` for number-like
  IDs (still stored as strings), `autoComplete="off"`.

## 9. Unsaved banner

`<div role="status">` always rendered; inside, when count > 0:
`mb-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink` —
"N changes made on this page only. Nothing is saved yet, so refreshing undoes them."
Count increments on every add and every edit that changed something.

## 10. Style tokens

| Use | Classes |
| --- | --- |
| Primary button | `rounded-md bg-brand-strong px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand` |
| Ghost button | `rounded-md px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-hover hover:text-fg` |
| Row text button | `rounded-md px-2 py-1 text-sm font-medium text-fg-muted hover:bg-surface-hover hover:text-fg` |
| Input / select | `mt-1 block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg focus:border-brand-strong focus:outline-none focus:ring-1 focus:ring-brand-strong aria-invalid:border-danger-strong` |
| Label | `block text-sm font-medium text-fg` |
| Hint / error | `mt-1 text-xs text-fg-subtle` / `text-danger` |
| Warning banner | `rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink` |

### Colour

Every colour is a semantic token defined once in `app/globals.css`, and
`html.dark` re-points the same names. **Never write a raw Tailwind colour
(`bg-white`, `text-gray-600`, `border-gray-200`) and never a `dark:` variant on
anything built from these tokens** — the theme is a variable swap, so pages
that use the tokens are already correct in both modes.

| Meaning | Token |
| --- | --- |
| Page background | `canvas` |
| Cards, tables, dialogs, popovers | `surface` |
| Recessed: nav rail, table head, open rows | `surface-muted` |
| Hover wash on buttons and rows | `surface-hover` |
| Headings and body copy | `fg` |
| Secondary copy, table headers, idle nav | `fg-muted` |
| Labels, hints, em-dashes | `fg-subtle` |
| Decorative glyphs only | `fg-faint` |
| Hairlines and dividers | `line` |
| Input borders, dashed empties | `line-strong` |
| Dialog backdrop (carries its own alpha) | `scrim` |
| Tooltips and transient chips | `tooltip` / `tooltip-fg` |
| Errors | `danger` (text) / `danger-strong` (fills, borders) |
| Warnings, unsaved notices | `warn-soft` / `warn-ink` |
| Map choropleth ramp | `map-0`…`map-4` + `map-N-ink` |
| Carrier chips (by-agent list) | `carrier-chip` + `-ink` / `-muted` / `-faint` / `-line`, and `carrier-soft` for tints |
| Agent tiles (carrier cards) | `agent-chip` / `agent-chip-ink` / `agent-chip-line` |
| Coverage bar fill | `bg-coverage-gradient` (the track behind it is `surface-muted`) |

Brand: `brand` (logo teal) is decorative only — strips, focus rings,
indicators. `brand-strong` is the fill behind white text, `brand-hover` its
hover, and `brand-ink` is brand-coloured *text* (it is light in dark mode, so
never use it as a fill). `brand-soft` / `brand-ink` marks active status and the
current nav item. `bg-brand-gradient` is the logo gradient strip.

Saturated data-viz accents (coverage bars, chart fills) may stay raw Tailwind
colours; they carry meaning by hue and read on either background.

To change how the app looks in either mode, edit the token block in
`app/globals.css` — nothing else.

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

### Contracts

Files: [lib/carrier-contracts.ts](../lib/carrier-contracts.ts),
[app/(dashboard)/contracts/by-carriers/](../app/(dashboard)/contracts/by-carriers/),
[app/(dashboard)/contracts/](../app/(dashboard)/contracts/).

**Two layers of states.**

| Field | Meaning | Edited on |
| --- | --- | --- |
| `CarrierRecord.availableStates` | Carrier footprint: states the carrier is available in for the agency | Carriers |
| `CarrierContractRecord.appointedStates` | States one agent may write for that carrier, always ⊆ the carrier's `availableStates` | Contracts (both views) |

**One source of truth for where agents write: carrier appointments.** A
`CarrierContractRecord` is one agent appointed with one carrier, with
`appointedStates` (state codes). There are no carrier-less agent licenses: an
agent can write in a state only through an appointment that lists it. The
carrier footprint is only the ceiling; it never makes an agent appointed.

- Both lists follow the same rules: empty means none yet, never "every state";
  a stored row missing the field loads as `[]` with a `console.warn`; values
  are unique codes in code order. Notes label them "Available states" (carrier)
  and "States" (appointment).
- `StateCheckboxes` ([components/state-checkboxes.tsx](../components/state-checkboxes.tsx))
  is the one state fieldset (heading, Select all, scrolling grid): every state on the Carriers dialog, only the carrier's
  `availableStates` in the contract dialog.
- One appointment per agent + carrier, checked in the form.
- Empty `appointedStates` means appointed nowhere yet, never "every state".
- A stored row missing `appointedStates` loads as `[]` with a `console.warn`.
- Notes label the field "States"; values are codes in code order joined with
  ", ", so reordering alone never records a change.

**One dialog.** Every add and edit on both pages opens `AppointmentDialog`
([contracts/appointment-dialog.tsx](../app/(dashboard)/contracts/appointment-dialog.tsx)):
agent, carrier and the state checkbox grid. Add starts empty (or with the
agent or carrier it was opened from); Edit starts filled in. `saveAppointment`
there is the pure save: duplicate check, ceiling check, note diff, next
contracts and notes. Each view keeps its own state and passes `onSave`, which
returns an `AppointmentError` (`{ field, message }`) shown under that field.

- The grid follows the chosen carrier and offers only its `availableStates`.
  No carrier chosen, or a carrier with none: a quiet hint, no boxes.
- `saveAppointment` rejects any state outside the ceiling with an error naming
  the states.
- Editing a contract with states outside the ceiling (older data, or a carrier
  whose footprint shrank) shows an amber "Saving removes …" warning; those boxes
  aren't offered, so saving strips them and the note records it. Contracts are
  never shrunk automatically when a carrier's footprint changes.

**By carriers**: chips in the Agents list show each appointment's states
(`stateSummary`) and open Edit.

**By state** is a read view over appointments, not a separate record (the map,
groupings and copy stay appointment-based; since appointments sit within the
ceiling, a state's By carrier list only holds carriers available there):

- The map counts distinct active agents with at least one appointment in the
  state.
- A selected state lists the same appointments By agent (carriers under each
  agent) or By carrier (agents under each carrier). Names link to profiles;
  the rest of a line opens Edit.
- The Appointments table (Agent, Carrier, States, Edit) searches state codes
  and names. Add contract and Edit open the shared dialog.

**Profiles** derive states the same way: the agent profile shows the union
across appointments plus each carrier's states; the carrier profile shows its
available states in the identity grid and each agent's appointed states on the
agent rows.

**Carriers** show `availableStates` as a States column (`stateSummary`, sorted
by count, searchable by code and name) and edit them with `StateCheckboxes` in
the add/edit dialog. Empty is allowed.

### Logins

Files: [lib/logins.ts](../lib/logins.ts),
[app/(dashboard)/logins/page.tsx](../app/(dashboard)/logins/page.tsx),
[app/(dashboard)/logins/logins-view.tsx](../app/(dashboard)/logins/logins-view.tsx),
[app/(dashboard)/logins/credential-value.tsx](../app/(dashboard)/logins/credential-value.tsx).

Logins is the first entity that points at other entities. A login is one
agent's access at one carrier.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `agentId` | yes | string | Shown by agent name. |
| `carrierId` | yes | string | Shown by carrier name. One login per agent + carrier. |
| `writingNumber` | yes | string | Producer ID the carrier assigned. Unique within a carrier, ignoring case. |
| `username` | yes | string | Portal username. |
| `portalPassword` | yes | string | Portal password, stored exactly as typed. Dummy values only (see Security). |
| `status` | yes | `"active" \| "pending" \| "inactive"` | Default `"active"` on add. |

**Loading.** `page.tsx` loads logins, notes, agents and carriers, and passes
slim `{ id, name, status }` options; the form's agent and carrier `<select>`s
are sorted by name with inactive ones marked "(inactive)". `page.tsx` also
calls `await connection()` so the route renders per request: the view reads
`?carrier=` with `useSearchParams`, and on a prerendered page that needs a
Suspense boundary (or the build fails) and would render the table on the
client. `getLogins()` returns ID order; a record missing `portalPassword`
loads as `""`, and a missing or unknown `status` loads as `"active"` with a
`console.warn` naming the login ID (server log, not the browser).

**Status.** `LoginStatus` in `lib/logins.ts` adds `pending`; it is
Logins-only. The Agent and Carrier status types are unchanged
(`active | inactive`). `StatusBadge` accepts all three (pending is amber, §6).

**Table.**

- Columns: **Agent, Carrier, Writing number, Portal username, Password, Status, [actions]**.
  No ID column; agent and carrier show names.
- Default sort: agent name, then carrier name. Rows are rebuilt from state on
  every render, so an add or edit lands in its sorted place at once.
- The agent name is the expand button (§7). The expanded row shows Notes only
  (no aliases). Several rows can be open at once (`Set` of login IDs).

**Carrier filter.**

- A `<select>` in `PageHeader` actions, left of Add login. Styled as
  `INPUT_CLASS` without `mt-1` and `w-full`; sr-only label "Filter by carrier".
  Options: "All carriers", then every carrier sorted by name (including ones
  with no logins), with " (inactive)" after inactive carriers.
- Stored as `?carrier=<carrierId>`. The value is React state seeded from the
  URL on first render, so the server and first client render agree (no flash
  of all logins, no hydration mismatch). A change sets state and calls
  `window.history.replaceState`: no reload, no refetch. "All carriers" removes
  the param. State drives the controlled select, rather than reading
  `useSearchParams` on each render, so it updates on the same render.
- Missing or unknown ID means all carriers; an unknown ID is left in the URL
  but the dropdown shows "All carriers".
- Filtering is client-side on the loaded list, before the sort. A login edited
  so it no longer matches drops out of the list; the filter is not reset.
- A filtered carrier with no logins shows one table row:
  "No logins for <carrier name>." (`EmptyState` is still used when there are no
  logins at all.)
- **Add pre-fill:** with a valid filter, Add opens with that carrier selected
  (inactive carriers too), still editable. With no filter it starts empty.
  Edit always starts on the login's own carrier. The form remounts on every
  open, so it uses the filter at that moment.
- **Hidden-login message:** when Add saves a login for a carrier other than the
  filter, a gray notice ("Login added for UHC. It's hidden by the current
  filter.") shows in the `role="status"` region under the unsaved banner. It
  clears on the next filter change or after 6 seconds; it is keyed by login
  ID, so a second hidden add restarts the timer.

**Validation.**

- Every field is `required`. Writing number and username are trimmed and use
  `pattern=".*\S.*"`.
- The password is **not** trimmed or lowercased and has no `pattern`.
  `onSubmit` rejects it when it is blank after trimming ("Password can't be
  blank."); otherwise it is saved exactly as typed, spaces included.
- One login per agent + carrier, error under Carrier:
  "Maria Alva already has a login at Humana."
- Writing number unique within a carrier, ignoring case, error under Writing
  number: "Writing number H4410087 is already used at Humana by Robt Klein."
  The number is shown as stored. Skipped when it's the same login the first
  error names.
- Messages use agent and carrier names, never IDs.

**Notes.**

- Agent and carrier are recorded **by name**, not ID: the view maps IDs to
  names before `diffValues`, so a note still reads well if a name changes later.
- The password is passed as a redacted field:
  `diffValues(FIELDS, before, after, ["portalPassword"])` compares the real
  values but records `{ field, from: "", to: "", redacted: true }`. `NoteList`
  renders a redacted change as "Password set" on an added note and "Password
  changed" on an edited one, alone or alongside other changes. The password
  value is never written to a note. Agents and Carriers don't pass `redact`.
- Status changes show as usual: "Status: active → pending".

**Hide/show and copy** (`credential-value.tsx`).

- `CredentialValue` renders the username and password cells. The password
  shows a fixed "••••••••" (same length for every password). Order in the
  password cell: value, eye button, copy button. Username stays visible and
  gets copy only. An empty value shows "—" with no buttons.
- The eye button toggles that row only: `aria-label` "Show password" / "Hide
  password"; eye icon while hidden, eye-off while visible.
- Reveal state is a boolean in each cell, reset whenever the value changes, so a page
  reload, a row filtered out and back, and a newly added login all start
  hidden, and an edit that saves a new password hides it again. An edit that
  leaves the password alone keeps a revealed row as it was.
- Copy: clicking the value (a `<button>` with `cursor-pointer` and a hover) or
  the copy icon calls `navigator.clipboard.writeText` with the exact stored
  value, untrimmed. It works while masked and does not reveal. Feedback swaps
  the icon for a check mark and shows "Copied" for 1.5 seconds, or "Couldn't
  copy" if the clipboard fails or is missing, as a small label floating above
  the icon so the cell width never changes. The `aria-live` region stays
  mounted.
- The clipboard needs a secure context: HTTPS or `localhost`. Over plain http
  on a network address, every copy shows "Couldn't copy".
- Only the agent button expands a row, so these buttons never trigger it.
- The form uses `PasswordInput`: `type="password"` until its eye button shows
  it, hidden again every time the dialog opens, `autoComplete="new-password"`
  so the browser doesn't fill in the signed-in user's own saved password.
- Icons are inline SVGs in the chevron's style (`aria-hidden`); no icon library.

**Security.**

- `data/logins.json` is committed to git, so it holds dummy passwords only
  (`dummy-pass-1` … `dummy-pass-5`). The TODO in `lib/logins.ts` says real
  passwords come only after the move to Supabase with admin-only access.
- Masking is on-screen only. Today every password is sent to the browser in
  the page's props and can be read in developer tools.
- Supabase plan: don't send passwords with the list. Fetch one login's password
  when it is revealed or copied, from an admin-only query.
