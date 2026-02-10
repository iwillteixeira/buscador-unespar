export type FilterMode =
  | "contains"
  | "equals"
  | "startsWith"
  | "word"
  | "regex";

function normalize(v: unknown) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function matchValue(
  value: unknown,
  search: string,
  mode: FilterMode
): boolean {
  if (!search) return true;

  const v = normalize(value);
  const s = normalize(search);

  switch (mode) {
    case "equals":
      return v === s;

    case "startsWith":
      return v.startsWith(s);

    case "word":
      // CONE ≠ MICROFONE
      return new RegExp(`\\b${s}\\b`, "i").test(v);

    case "regex":
      return new RegExp(search, "i").test(String(value));

    default:
      return v.includes(s);
  }
}
