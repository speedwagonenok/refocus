function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeSessionPrice(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const n = Math.trunc(value);
    if (n < 0 || n > 1_000_000) return null;
    return n === 0 ? null : n;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return n === 0 ? null : n;
}

/** Если в БД/драйвере JSON пришёл строкой — распарсить; иначе вернуть как есть. */
export function unwrapDoctorSymptomsJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const t = raw.trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function isIndexOnlyObject(value: object): value is Record<string, unknown> {
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
}

function dedupePreferFirstCaseInsensitive(strings: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of strings) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/**
 * Список строк из поля JSON: массив строк, CSV-строка, JSON-массив в виде строки,
 * объект только с числовыми ключами (как иногда сериализуют «массив»).
 */
export function normalizeFlexibleStringList(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return [];
    if (t.startsWith("[") && t.endsWith("]")) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) {
          return normalizeStringArray(parsed);
        }
      } catch {
        // ниже — как CSV
      }
    }
    return t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return normalizeStringArray(value);
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (isIndexOnlyObject(o)) {
      return Object.keys(o)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => o[k])
        .filter((v): v is string => typeof v === "string")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

const DISEASE_JSON_KEYS = ["diseases", "diagnoses", "illnesses", "заболевания"] as const;

function collectDiseasesFromRecord(rec: Record<string, unknown>): string[] {
  const merged: string[] = [];
  for (const k of DISEASE_JSON_KEYS) {
    merged.push(...normalizeFlexibleStringList(rec[k]));
  }
  return dedupePreferFirstCaseInsensitive(merged);
}

/** Разбор поля User.doctorSymptoms (JSON): симптомы, заболевания, цена за сеанс. */
export function parseDoctorMatchMeta(raw: unknown): {
  symptoms: string[];
  diseases: string[];
  sessionPrice: number | null;
} {
  const data = unwrapDoctorSymptomsJson(raw);
  if (data === null) {
    return { symptoms: [], diseases: [], sessionPrice: null };
  }

  if (Array.isArray(data)) {
    return { symptoms: normalizeFlexibleStringList(data), diseases: [], sessionPrice: null };
  }
  if (typeof data !== "object") {
    return { symptoms: [], diseases: [], sessionPrice: null };
  }

  const rec = data as Record<string, unknown>;
  return {
    symptoms: normalizeFlexibleStringList(rec.symptoms),
    diseases: collectDiseasesFromRecord(rec),
    sessionPrice: normalizeSessionPrice(rec.sessionPrice),
  };
}

/** Только список симптомов (совместимость). */
export function parseDoctorSymptomsFromJson(raw: unknown): string[] {
  return parseDoctorMatchMeta(raw).symptoms;
}
