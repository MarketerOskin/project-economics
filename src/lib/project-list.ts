/** "Название; Клиент" per line → manual projects. */
export function parseProjectList(text: string): Array<{ name: string; clientName: string | null }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(/\s*[;\t]\s*/);
      const client = rest.join(' ').trim();
      return { name: name!.trim().slice(0, 200), clientName: client ? client.slice(0, 200) : null };
    })
    .filter((p) => p.name.length > 0);
}
