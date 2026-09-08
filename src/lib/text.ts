/** Initials from a full name, e.g. "Анна Ковалёва" -> "АК". Server- and client-safe. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
