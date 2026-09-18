/*
 * Small text helpers every page reaches for. Client-safe: no server-only
 * import, so dialogs and views can use them too.
 */

/** Sort comparator for anything with a name: agents, carriers, options. */
export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** First letters of the first and last word: "Maria Alva" → "MA", "Jane Q. Doe" → "JD", "Cher" → "C". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => word[0].toUpperCase()).join("");
}
