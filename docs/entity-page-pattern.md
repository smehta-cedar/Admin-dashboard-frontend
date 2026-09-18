# Entity page pattern

How the Agents page is built, written as a reference for the next entity pages
(Carriers, Rulebook, Logins, Contracts, Users, Agency). Reference implementation:

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
| `components/data-table.tsx` | `DataTable`, `DataTableColumn<T>`, `DataTableRowContext` (sort + search + pagination + expandable rows, §6) |
| `components/table-pagination.tsx` | `TablePagination`, `useTablePagination` (5 / 10 / 20 page sizes; used by `DataTable` and `ProfileTable`) |
| `components/status-badge.tsx` | `StatusBadge`, `statusRank` (sort order: active, review, pending, jit, inactive; review and jit are state-licence only, and JIT renders uppercase) |
| `components/modal-dialog.tsx` | `useModalDialog(open)` → `{ dialogRef, close }`, `ModalDialog` |
| `components/classes.ts` | `INPUT_CLASS`, `PRIMARY_BUTTON_CLASS`, `GHOST_BUTTON_CLASS`, `ROW_BUTTON_CLASS`, `TOOLBAR_INPUT_CLASS` |
| `lib/change-notes.ts` | `nextId`, `fieldText`, `diffValues(FIELDS, before, after, redact?)`, `FieldChange<F>` |
| `lib/text.ts` | `byName` (sort comparator), `initials("Maria Alva") → "MA"` — the only copies |
| `components/unsaved-banner.tsx` | `UnsavedBanner({ count, className? })` (§9) |
| `components/hydrated-note-list.tsx` | `HydratedNoteList` — `NoteList` gated on hydration, for a profile's Notes panel |
| `components/entity-switcher.tsx` | `EntitySwitcher({ label, currentId, options, hrefFor })` — the profile's "Switch agent/carrier" select, sorted by name, inactive grouped last |
| `components/credential-value.tsx` | `CredentialValue` (copy-on-click, masked when `secret`), `PasswordInput` (eye toggle) — Logins, Users, sign-in, profiles |
| `components/license-number.tsx` | `LicenseNumber` (a licensed-state card's number, click to copy, or "No number yet"; agent and agency profiles) |
| `components/producer-form.tsx` | `ProducerForm` + `producerNoteValues`, `unnumberedStatesError` — the one agent/agency form (see Agency) |
| `components/profile-shell.tsx` | Profile layout pieces: `ProfileBackLink`, `ProfileNameRow`, `ProfileHeader`, `ProducerDetails`, `Detail`, `LicenseCards`, `StateChip`, `Count`, `Panel`, `PanelEmpty`, `ProfileTable` (paginated), `StateChipCell`, `LoginsPanel`, `PROFILE_BUTTON_CLASS` (see Contracts → Profiles) |
| `app/(dashboard)/contracts/use-appointments.ts` | `useAppointments` — contracts + notes state, the open `AppointmentDialog` editor, and its `saveContract` (see Contracts → One dialog) |

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
- **Phones:** one format, `(555)010-4410`. `formatPhone` in `lib/phone.ts` is
  applied when data loads (`lib/agents.ts`) and when the form saves; anything
  that isn't 10 digits stays as entered. Search also matches the bare digits.
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
- **Pagination:** client-side, under the table (`table-pagination.tsx`). Default
  5 rows; Show select for 5 / 10 / 20; range text and ‹ ›. Hidden while the
  filtered list fits in 5 or fewer. Resets to page 1 when the search changes.
  `ProfileTable` on profiles uses the same control.
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
- Column order used on Agents: **ID, NPN, Name, Status, Email, Phone, [actions]**
  (no states column; licences are read on the profile).
- IDs and codes: `font-mono text-fg-muted`. Secondary text: `text-fg-muted`.
  Primary name: `text-fg`, `whitespace-nowrap`.
- Status badge: `rounded-md px-2 py-0.5 text-xs font-medium capitalize` +
  `active: bg-brand-soft text-brand-ink`, `inactive: bg-surface-hover text-fg-muted`
  (and `pending: bg-warn-soft text-warn-ink` for Logins; `review: bg-info-soft text-info-ink`
  and an outlined neutral `jit` for state licences).
- Row action: text button `Edit` with sr-only entity name
  (`Edit<span className="sr-only"> {name}</span>`), right-aligned.
- Secondary/list data (aliases, notes) does **not** go in the main row — see §7.

Profile pages' related tables use `ProfileTable`, which shares the same
pagination control.

## 7. Expandable row (name dropdown)

Agents and Carriers no longer use this: their rows don't expand, the name is
just a link to the profile, and aliases and notes are read there. The pattern below still
applies to the lists that pass `renderDetails`.

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
- Classes: `m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg bg-surface p-0 shadow-xl backdrop:bg-scrim`
  (`m-auto` is needed because Tailwind preflight zeroes dialog margins).
- The dialog stays `p-0`; the `<form>` owns the inset (`p-6`). Padding on the
  dialog itself would create a ring inside it where clicks hit the backdrop
  handler and close the form.
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

`<UnsavedBanner count={unsavedCount} />` from
[components/unsaved-banner.tsx](../components/unsaved-banner.tsx): a
`<div role="status">` always rendered; inside, when count > 0,
`rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink` —
"N changes made on this page only. Nothing is saved yet, so refreshing (or
leaving the page) undoes them." `className` sets the margin: `mb-4` (default)
on list pages, `mt-4` on profiles. Count increments on every add and every
edit that changed something.

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
| "Under review" status | `info-soft` / `info-ink` |
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
   The typecheck has `noUnusedLocals` and `noUnusedParameters` on, so an unused
   import, local or parameter fails it; there is no ESLint (typescript-eslint
   can't run on the TypeScript 7 toolchain this project uses).

## 13. Shared helpers

Extracted when Carriers became the second page and again after the Sep 2026
audit; see the table in §2. Still copied per view (small, and may diverge):
the name toggle button with chevron and the aliases section.

Carriers ([app/(dashboard)/carriers/carriers-view.tsx](../app/(dashboard)/carriers/carriers-view.tsx))
uses the shared `CarrierDialog` + `saveCarrier` (same component the carrier
profile opens). Two variations on the Agents form: a required checkbox group
(`<fieldset>` + `<legend>`, "at least one" checked in `saveCarrier`, error on
each checkbox via `aria-invalid`/`aria-describedby`), and a name uniqueness
check against other carriers' names *and* aliases, ignoring case.

### Contracts

Files: [lib/carrier-contracts.ts](../lib/carrier-contracts.ts),
[app/(dashboard)/contracts/by-carriers/](../app/(dashboard)/contracts/by-carriers/),
[app/(dashboard)/contracts/](../app/(dashboard)/contracts/).

**Three layers of states.**

| Field | Meaning | Edited on |
| --- | --- | --- |
| `AgentRecord.licensedStates` | Personal licences: where the agent may write at all, whoever the carrier. **Derived** from the agent's state licence rows (see Agent state licences), never stored | Agents |
| `AgentRecord.licenseNumbers` | The licence number each state issued, `{ TX: "2104587" }`. Derived from the same rows; a row whose number is still blank (a pending licence) is left out ("No number yet", and a Pending item). The agent dialog shows a required input per checked state and `saveAgent` rejects a licensed state without a number. Not a ceiling — it never affects writable states | Agents |
| `CarrierRecord.availableStates` | Carrier footprint: states the carrier is available in for the agency | Carriers |
| `CarrierContractRecord.appointedStates` | States one agent may write for that carrier, always ⊆ `licensedStates ∩ availableStates` | Contracts (both views) |

**An appointment is still what makes an agent contracted; the two ceilings only
limit it.** A `CarrierContractRecord` is one agent appointed with one carrier,
with `appointedStates` (state codes). A licence alone never lets an agent write
anywhere — there must be an appointment listing the state — and an appointment
can never reach past either ceiling. So the states an agent can actually write
with a carrier are

```
writable = appointedStates ∩ agent.licensedStates ∩ carrier.availableStates
```

`writableStates(appointed, licensed, available)` in
[lib/us-states.ts](../lib/us-states.ts) computes it (over `intersectStates`),
and every list, map, chip and profile row shows that, never the raw
appointment. Keeping `appointedStates` as a stored subset (rather than deriving
it as the whole intersection) is what lets a carrier appoint an agent in fewer
states than they could otherwise write in.

- All three lists follow the same rules: empty means none yet, never "every
  state"; a stored row missing the field loads as `[]` with a `console.warn`;
  values are unique codes in code order. Notes label them "Licensed states"
  (agent), "Available states" (carrier) and "States" (appointment).
- `StateCheckboxes` ([components/state-checkboxes.tsx](../components/state-checkboxes.tsx))
  is the one state fieldset (heading, Select all, scrolling grid): every state
  on the Agents and Carriers dialogs, the carrier's footprint in the contract
  dialog. `disabledCodes` lists states that stay visible but can't be picked
  (disabled box, muted label, `disabledTitle` tooltip): Select all skips them,
  and they render unchecked with no `name`, so they never submit.
- One appointment per agent + carrier, checked in the form.
- A stored row missing `appointedStates` loads as `[]` with a `console.warn`.

**Inactive agents: one rule, every surface.** A contract follows the agent,
not the agent's status, exactly as it already does for carriers. So wherever
contracts are listed — both Contracts pages, both profiles, the dialog's agent
select — an inactive agent's contracts appear and can be edited, marked
"(inactive)" (a muted tile on the by-carrier cards). What changes is
**counting**: anything that says how much coverage the agency has counts active
agents only — the by-state map and its legend ("Active agents appointed"), the
"Agents appointed" stat, the by-carrier chart and each card's n/total and bar.
Both `page.tsx` files therefore pass **every** agent with `status`, never a
pre-filtered list. Deactivating an agent on Agents changes the numbers, not
what is listed; nothing is hidden and no "include inactive" toggle is needed.
- Notes label the field "States"; values are codes in code order joined with
  ", ", so reordering alone never records a change.

**One dialog.** Every add and edit on both pages opens `AppointmentDialog`
([contracts/appointment-dialog.tsx](../app/(dashboard)/contracts/appointment-dialog.tsx)):
agent, carrier and the state checkbox grid. Add starts empty (or with the
agent or carrier it was opened from); Edit starts filled in. `saveAppointment`
there is the pure save: duplicate check, ceiling check, note diff, next
contracts and notes. Each view keeps its own state and passes `onSave`, which
returns an `AppointmentError` (`{ field, message }`) shown under that field.

- Both selects are controlled, and the grid follows whichever changes: it
  lists all of `carrier.availableStates`, and a box is enabled only when the
  state is also in `agent.licensedStates`. The rest are disabled with the
  tooltip "Agent not licensed in {state}" — Humana in FL, LA, TX with an agent
  licensed in LA, TX shows FL disabled and LA/TX checkable, and Select all
  never checks FL. Until both are chosen, or when the carrier has no footprint,
  a quiet hint replaces the boxes; with no licences or no overlap the grid
  shows fully disabled and the hint says why.
- `saveAppointment` takes `licensedStates(agentId)` alongside
  `availableStates(carrierId)` and checks each half separately, so the error
  names the side that blocks the state and the page that fixes it
  ("Humana isn't available in NM…" / "Pri Natz isn't licensed in LA…").
- Editing a contract with states outside the ceiling (older data, a carrier
  whose footprint shrank, or an agent who dropped a licence) shows an amber
  "Saving removes …" warning that says which side dropped each code; those
  boxes are missing (outside the footprint) or disabled and unchecked
  (unlicensed), so saving strips them and the note records it.
  Contracts are never shrunk automatically when a footprint or licence changes.

**By carriers**: chips in the Agents list show each appointment's writable
states (`stateSummary`) and open Edit.

**By state** is a read view over appointments, not a separate record (the map,
groupings and copy stay appointment-based; since appointments sit within both
ceilings, a state's By carrier list only holds carriers available there, and
its By agent list only agents licensed there):

- The map counts distinct active agents with at least one appointment in the
  state.
- A selected state lists the same appointments By agent (carriers under each
  agent) or By carrier (agents under each carrier). Names link to profiles;
  the rest of a line opens Edit.
- The Appointments table (Agent, Carrier, States, Edit) searches state codes
  and names. Add contract and Edit open the shared dialog.

**Profiles** derive states the same way. The agent profile shows **Licensed
states** (`licensedStates`: personal, "whoever the carrier") and, on each
carrier row, that appointment's writable states; there is no combined
"Writable states" section across carriers. The carrier profile shows its
available states as chips on its header card and each agent's writable states
as chips on the agent rows.

The agent profile is also an entry point: **Add carrier** in the Carriers
section header opens the same `AppointmentDialog` in add mode with that agent
pre-filled (`agents` is just that one agent, so it can't be changed), and saves
through the same `saveAppointment`, so the duplicate and ceiling checks and the
note are identical. That makes `agent-profile.tsx` a client component holding
contracts, notes and the unsaved count; `page.tsx` passes **every** carrier (the
dialog's options) and **every** contract and contract note (the duplicate check
and `nextId` need the full lists), and the profile picks out the agent's own
rows.

All three profiles (agent, carrier, agency) lay themselves out from the
shared pieces in `components/profile-shell.tsx`, top to bottom:
`ProfileBackLink` beside `EntitySwitcher` (`components/entity-switcher.tsx`),
`ProfileNameRow` (avatar, name, status, Edit; `eyebrow` for "Agency"),
`ProfileHeader` (`details` = `Detail` rows or `ProducerDetails`, beside one
titled aside, e.g. `LicenseCards` or `StateChip`s), `UnsavedBanner`, then
`Panel`s: a `ProfileTable` (headings + `<tr>` per row; the caller renders the
`<td>`s, with `StateChipCell` for a states column), `LoginsPanel` (agent and
carrier profiles; `page.tsx` resolves the other party into `partyName` /
`partyHref`), and Notes as `HydratedNoteList`. `PROFILE_BUTTON_CLASS` is the
soft-brand action button ("+ Add carrier"). The agent profile, top to bottom:

- **Name row**: initials, name, status badge under it, and **Edit**, which opens
  the same `AgentDialog` as the Agents list
  ([agents/agent-dialog.tsx](../app/(dashboard)/agents/agent-dialog.tsx):
  `AgentDialog` + pure `saveAgent`, the same shape as `carrier-dialog.tsx`;
  `AGENT_FIELD_LABELS` lives there). The profile keeps the agent in state, so
  `page.tsx` keys it by agent ID, passes `npn` in `allAgents` for the uniqueness
  check, and passes **every** agent note (new note IDs need them all).
- **Identity card** (no `ProfileHeader` here): one muted meta line — NPN
  (mono) · email · phone · aliases, filled fields only, mailto/tel links kept.
  From `lg` it shares its row 3/5 | 2/5 with the **attention column**; while
  that column is empty the card takes the whole row.
- **Attention column**: the `role="status"` unsaved banner (agent edits and new
  appointments both count; always mounted), then the **Pending strip**, only
  when there is something pending (no empty state): one bordered list with the
  warn left edge.
- **Panels**, each with a padded body (`p-4 sm:p-5`) so its table or list sits
  inset in its own `rounded-lg border border-line` box, on a 10-column grid
  from `lg`: Carriers (a table: Carrier, Writable states, Status; "+ Add
  carrier" in its title row) beside `StateLicensesPanel`, 50/50; then
  `LoginsPanel` beside Notes, 70/30. Below `lg` they stack in that order. No
  sticky rail, no tabs.
- **Pending** is derived by `pendingItems`, not stored — there are no task
  records yet: no licences, licensed states with no licence number, an appointment with no writable states, licensed
  states no appointment covers, carriers with no login (one line), a login with
  no contract, and logins whose status is pending. Swap it for real tasks when
  they exist.

The carrier profile (`carrier-profile.tsx`, a client component) follows
the same layout: name row (initials, name, status, Edit), a header card with
Carrier ID / aliases / lines of business beside **Available states** as
`StateChip`s, then panels — Agents (a table: Agent, Writable states, Status)
beside Notes, and Logins full width under them (`Panel className="xl:col-span-2"`).
Edit opens the shared `CarrierDialog` (same form as the Carriers list) filled
in from the carrier; saves stay on the page only until refresh, with the same
unsaved banner as the agent profile. Writable states on agent rows recompute
from the live `availableStates` after an edit.

**Carriers** shows its list as a States column (`stateSummary`, sorted by
count, searchable by code and name); **Agents** no longer has one (the profile
shows licences). Both edit their list with `StateCheckboxes` in the add/edit
dialog — `licensedStates` on Agents, `availableStates` on Carriers. Empty is
allowed on both.

### Agent state licences

Files: [lib/state-licenses.ts](../lib/state-licenses.ts) (client-safe: the
shared row type, the derivations and `applyLicenceEdits`),
[lib/agent-state-licenses.ts](../lib/agent-state-licenses.ts),
[data/agent-state-licenses.json](../data/agent-state-licenses.json),
[components/state-licenses-panel.tsx](../components/state-licenses-panel.tsx).

One row per agent + state: `id`, `agentId`, `state`, `licenseNumber`,
`status` (`active | review | pending | jit`), `startDate`, `endDate`
(`YYYY-MM-DD`). `getAgentStateLicenses()` returns ID order; a missing or
unknown status loads as `"active"` with a `console.warn`.

**The rows are the truth.** `agents.json` no longer holds `licensedStates` or
`licenseNumbers`: `getAgents()` / `getAgent()` derive both from the agent's
rows (`licensedStatesOf`, `licenseNumbersOf` — every row lists its state
whatever its status; a blank number is left out). The two fields stay on
`AgentRecord` because Contracts and the profiles read them.

**Edit goes through the rows too.** The producer form still edits checked
states and their numbers, but `saveAgent` takes `licenses` (every agent's
rows — new IDs need them all) and returns the next rows via
`applyLicenceEdits`: a checked state keeps its row with the number as typed,
an unchecked state's row is dropped, a newly checked state gets a new
`active` row starting today and ending two years later (`LICENCE_TERM_YEARS`;
the form doesn't ask for dates or a status yet). The saved agent's two fields
are then derived from those rows, so the note diff, the header cards and the
panel all agree. Both the Agents list and the agent profile keep the rows in
state and set them from the save result.

The profile shows the rows in `StateLicensesPanel` (State, Licence #, Status,
Start, End; dates formatted from the string with `formatLicenceDate`, not
`Date`, so server and client agree). No licences list page.

### Logins

Files: [lib/logins.ts](../lib/logins.ts),
[app/(dashboard)/logins/page.tsx](../app/(dashboard)/logins/page.tsx),
[app/(dashboard)/logins/logins-view.tsx](../app/(dashboard)/logins/logins-view.tsx),
[app/(dashboard)/logins/login-dialog.tsx](../app/(dashboard)/logins/login-dialog.tsx)
(`LoginDialog` + pure `saveLogin`, which returns every error at once like
`saveCarrier`; `LOGIN_FIELD_LABELS` lives there; Add starts on the filtered
carrier via `{ mode: "add", carrierId }`),
[components/credential-value.tsx](../components/credential-value.tsx).

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

### Users

Files: [lib/users.ts](../lib/users.ts), [data/users.json](../data/users.json),
[app/(dashboard)/users/](../app/(dashboard)/users/) (`users-view.tsx`,
`user-dialog.tsx`).

The people who sign in: the agency's admin and staff accounts. A list only
(no profile page); `UserDialog` + pure `saveUser` follow the agent-dialog
shape.

**Phase 1: login roles are `admin | staff` only.** Agents and the agency do
not sign in yet, so there is no agent role, no link from a user to an
`AgentRecord`, and nothing on this page reads `lib/agents.ts`. Agent / agency
login is a later phase and will be designed then (its own role, or its own
sign-in path) rather than half-wired here.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `name` | yes | string | Display name. |
| `email` | yes | string | What they sign in with. Unique, ignoring case. |
| `role` | yes | `"admin" \| "staff"` | Default `"staff"` on add. **Stored and shown only** — nothing is gated by it yet; every signed-in user sees the whole app. |
| `status` | yes | `"active" \| "inactive"` | Inactive users can't sign in (and are signed out on their next request). |
| `password` | yes | string | Dummy only, like Logins; never trimmed; redacted in notes. |

- Columns: **Name (expands to Notes), Email, Password (masked `CredentialValue`,
  never sortable or searchable), Role, Status, [actions]**. ID order.
- Loading: an unknown `role` reads as `"staff"`, an unknown `status` as
  `"active"`, each with a `console.warn` naming the user. `data/users.json`
  is kept clean of both, so a warning in dev means a real data problem.
- Dialog errors under the field: "Email x already belongs to Y.", "Password
  can't be blank.".
- Notes record the password as `diffValues(FIELDS, before, after, ["password"])`
  (§Logins).

### Fake session (until Supabase Auth)

Not an entity, but Users is what it signs in against.

- [lib/fake-session.ts](../lib/fake-session.ts) (client-safe): the cookie name
  `mc-fake-session`, whose value is the user's ID; `setSessionCookie` /
  `clearSessionCookie` write it from the browser (30 days, `samesite=lax`,
  **not** HttpOnly or signed — anyone can set it to any ID; it decides only who
  the app shows as signed in); `SessionUser` (`id, name, email, role`, never the
  password); `initials`.
- [lib/session.ts](../lib/session.ts) (server-only): `getSessionUser()` reads
  the cookie with `cookies()` and resolves it against `getUsers()`; null when
  missing, unknown, or inactive.
- [app/login/](../app/login/) sits outside the dashboard group (no shell). The
  page passes slim `{ id, email, password, status }` rows; the form matches
  email ignoring case and password exactly, shows "Email or password is wrong."
  (one message for both, so it doesn't confirm which emails exist) or "That
  account is inactive.", then sets the cookie and `router.push("/")` +
  `router.refresh()`. A signed-in visitor to `/login` is redirected to `/`.
- The **soft gate** is the dashboard layout
  ([app/(dashboard)/layout.tsx](../app/(dashboard)/layout.tsx)): no session →
  `redirect("/login")`. Checked on the server so nothing flashes; no
  middleware/proxy. Reading `cookies()` there makes every dashboard route
  render per request, which a session needs anyway. The layout passes the
  `SessionUser` to `AppShell` → `Navbar`, whose avatar menu shows name, email
  and Sign out (clears the cookie, `router.push("/login")` + `refresh()`).
- Non-goals for now: Supabase Auth, hashing, HttpOnly cookies, role-based
  route or field permissions.

### Agency

Files: [lib/agency.ts](../lib/agency.ts), [data/agency.json](../data/agency.json),
[data/agency-notes.json](../data/agency-notes.json),
[app/(dashboard)/agency/](../app/(dashboard)/agency/) (`agency-profile.tsx`,
`agency-dialog.tsx`).

The one org record for this shop: its identity, licence footprint and roster.
**A singleton**: `data/agency.json` is one object, not an array, so
`AgencyRecord` has no `id`, `AgencyField` is `keyof AgencyRecord`,
`AgencyNote` has no `agencyId`, and there is no list page, no back link and no
add. `getAgency()` returns the object; `getAgencyNotes()` the notes, newest
first.

- Same producer shape as `AgentRecord` (name, aliases, status, npn,
  licensedStates, licenseNumbers, email, phone), loaded the same way:
  `formatPhone`, and the two licence fields derived from the agency's licence
  rows (`lib/agency-state-licenses.ts`), not stored in `agency.json`.
  `saveAgency` takes and returns those rows exactly as `saveAgent` does.
- `AgencyDialog` + pure `saveAgency` render the shared `ProducerForm`
  ([components/producer-form.tsx](../components/producer-form.tsx)) with org
  `labels` (`AGENCY_FIELD_LABELS` for notes: "Agency name", "Other names",
  "Agency NPN", …), edit only. `AgentDialog` renders the same form with agent
  labels; the form owns the fields, the licence-number inputs per checked
  state and the submit parsing, while each dialog keeps its own pure save.
  Same "every checked state needs its licence number" check
  (`unnumberedStatesError`); no NPN uniqueness, since nothing else has an
  agency NPN.
- Profile layout mirrors the agent profile: name row (avatar, "Agency"
  eyebrow, name, status, Edit), header card (NPN / email / phone / other names
  beside licensed-state cards with `LicenseNumber`), unsaved banner, a
  full-width **State licences** panel (`StateLicensesPanel` over rows from
  [lib/agency-state-licenses.ts](../lib/agency-state-licenses.ts) /
  `data/agency-state-licenses.json` — same shape as the agent's minus
  `agentId`, since the agency is a singleton; same status fallback; edited
  through the profile's Edit like the agent's), then **Agents** (read-only table of every agent: name →
  `/agents/[id]`, licensed-state chips, status; "Manage on Agents →") beside
  **Notes**.
- Not a participant in contracts or logins: appointments stay on individual
  agents. Multi-agency is out of scope.
- Nav: a footer item pinned to the bottom of the rail and drawer
  (`footerItems` on `AppShell`).
