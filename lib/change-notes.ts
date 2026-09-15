/*
 * Helpers for entity change notes (docs/entity-page-pattern.md §4). Pure and
 * client-safe, unlike the server-only entity modules.
 */

/**
 * One field's value before and after, as shown in the UI. A redacted change
 * (e.g. a password) records only that the field changed: from and to are empty.
 */
export type FieldChange<F extends string> = {
  field: F;
  from: string;
  to: string;
  redacted?: boolean;
};

type FieldValues<F extends string> = Record<F, string | string[]>;

/** Next number after the highest ID, so lists stay 1…n. */
export function nextId(items: { id: string }[]) {
  return String(items.reduce((max, item) => Math.max(max, Number(item.id)), 0) + 1);
}

/** A field as shown in notes: lists are joined with ", ", missing is "". */
export function fieldText<F extends string>(values: Partial<FieldValues<F>>, field: F): string {
  const value: string | string[] | undefined = values[field];
  return Array.isArray(value) ? value.join(", ") : (value ?? "");
}

/**
 * Fields whose shown value differs, in `fields` order. Fields in `redact` are
 * compared the same way but recorded without their values.
 */
export function diffValues<F extends string>(
  fields: readonly F[],
  before: Partial<FieldValues<F>>,
  after: FieldValues<F>,
  redact: readonly F[] = [],
): FieldChange<F>[] {
  return fields.flatMap((field) => {
    const from = fieldText(before, field);
    const to = fieldText(after, field);
    if (from === to) return [];
    return redact.includes(field) ? [{ field, from: "", to: "", redacted: true }] : [{ field, from, to }];
  });
}
