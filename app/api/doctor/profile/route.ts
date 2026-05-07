import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  absoluteDoctorFilePath,
  readAvatarFile,
  saveDiplomaPdfFile,
  unlinkIfExists,
} from "@/lib/doctorUploads";
import { parseDoctorMatchMeta, unwrapDoctorSymptomsJson } from "@/lib/doctorSymptomsJson";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

const AVATAR_PUBLIC_URL = "/api/doctor/files/avatar";

type DiplomaMetaItem = {
  id: number | null;
  title: string;
  issuedBy?: string | null;
  year?: number | null;
};

type EducationItem = {
  when: string;
  institution: string;
  specialty: string;
};

type JsonPayload = {
  doctorBio?: string;
  symptoms?: string[];
  diseases?: string[];
  education?: EducationItem[];
  sessionPrice?: number | string | null;
};

const ALLOWED_SYMPTOMS = [
  "Тревога / внутреннее напряжение",
  "Панические атаки",
  "Фобии / избегающее поведение",
  "Навязчивые мысли и действия",
  "Депрессивное настроение",
  "Потеря интереса и мотивации",
  "Раздражительность / вспышки гнева",
  "Эмоциональная нестабильность",
  "Хроническая усталость / апатия",
  "Нарушение сна",
  "Выгорание / хронический стресс",
  "ПТСР-симптомы",
  "Психосоматические жалобы",
  "Адаптационные трудности",
  "Трудности в отношениях",
  "Низкая самооценка / чувство вины",
  "Расстройства пищевого поведения",
  "Проблемы концентрации и памяти",
  "Зависимое поведение",
  "Суицидальные мысли",
] as const;

const ALLOWED_DISEASES = [
  "Генерализованное тревожное расстройство (ГТР)",
  "Паническое расстройство",
  "Социальное тревожное расстройство",
  "Специфические фобии",
  "Депрессивное расстройство",
  "Рекуррентное депрессивное расстройство",
  "Биполярное аффективное расстройство",
  "Циклотимия",
  "Посттравматическое стрессовое расстройство (ПТСР)",
  "Острое стрессовое расстройство",
  "Расстройство адаптации",
  "Обсессивно-компульсивное расстройство (ОКР)",
  "Расстройство личности",
  "Соматоформное расстройство",
  "Расстройство сна (психогенное)",
] as const;

const ALLOWED_SYMPTOMS_SET = new Set<string>(ALLOWED_SYMPTOMS);
const ALLOWED_DISEASES_SET = new Set<string>(ALLOWED_DISEASES);

function normalizeEducationYear(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  const fromDate = trimmed.match(/^\d{2}\.\d{2}\.(\d{4})$/);
  if (fromDate) return fromDate[1];
  return trimmed.replace(/\D/g, "").slice(0, 4);
}

function isValidEducationYear(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) return false;
  const year = Number(trimmed);
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSymptoms(rawSymptoms: unknown): string[] {
  if (!Array.isArray(rawSymptoms)) {
    return [];
  }
  return rawSymptoms
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function splitCsvValues(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasOnlyAllowedValues(values: string[], allowedSet: Set<string>): boolean {
  return values.every((value) => allowedSet.has(value));
}

function normalizeEducation(rawEducation: unknown): EducationItem[] {
  if (!Array.isArray(rawEducation)) return [];
  const out: EducationItem[] = [];
  for (const item of rawEducation) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const when = typeof rec.when === "string" ? normalizeEducationYear(rec.when) : "";
    const institution = typeof rec.institution === "string" ? rec.institution.trim() : "";
    const specialty = typeof rec.specialty === "string" ? rec.specialty.trim() : "";
    if (!when && !institution && !specialty) continue;
    if (!when || !institution || !specialty) continue;
    if (!isValidEducationYear(when)) continue;
    out.push({ when, institution, specialty });
  }
  return out;
}

function normalizeDiseases(rawDiseases: unknown): string[] {
  if (!Array.isArray(rawDiseases)) {
    return [];
  }
  return rawDiseases
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
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

function parseDoctorMeta(
  raw: unknown,
): { symptoms: string[]; diseases: string[]; education: EducationItem[]; sessionPrice: number | null } {
  const base = parseDoctorMatchMeta(raw);
  const data = unwrapDoctorSymptomsJson(raw);
  let education: EducationItem[] = [];
  if (data && typeof data === "object" && !Array.isArray(data)) {
    education = normalizeEducation((data as Record<string, unknown>).education);
  }
  return { ...base, education };
}

function parseDiplomasMeta(raw: unknown): DiplomaMetaItem[] | null {
  if (typeof raw !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const out: DiplomaMetaItem[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        return null;
      }
      const rec = item as Record<string, unknown>;
      const id = rec.id === null || rec.id === undefined ? null : Number(rec.id);
      if (id !== null && (!Number.isInteger(id) || id <= 0)) {
        return null;
      }
      const title = typeof rec.title === "string" ? rec.title.trim() : "";
      if (!title) {
        return null;
      }
      const issuedBy =
        typeof rec.issuedBy === "string" && rec.issuedBy.trim().length > 0 ? rec.issuedBy.trim() : null;
      let year: number | null = null;
      if (rec.year !== undefined && rec.year !== null) {
        const y = Number(rec.year);
        if (!Number.isInteger(y)) {
          return null;
        }
        year = y;
      }
      out.push({ id, title, issuedBy, year });
    }
    return out;
  } catch {
    return null;
  }
}

function parseEducationMeta(raw: unknown): EducationItem[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out: EducationItem[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const when = typeof rec.when === "string" ? normalizeEducationYear(rec.when) : "";
      const institution = typeof rec.institution === "string" ? rec.institution.trim() : "";
      const specialty = typeof rec.specialty === "string" ? rec.specialty.trim() : "";
      if (!when || !institution || !specialty) return null;
      if (!isValidEducationYear(when)) return null;
      out.push({ when, institution, specialty });
    }
    return out;
  } catch {
    return null;
  }
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const doctor = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      avatarUrl: true,
      doctorBio: true,
      doctorSymptoms: true,
      doctorDiplomas: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          issuedBy: true,
          year: true,
          filePath: true,
        },
      },
    },
  });

  if (!doctor) {
    return NextResponse.json({ message: "Врач не найден." }, { status: 404 });
  }

  const hasAvatarFile = (await readAvatarFile(sessionUser.id)) != null;
  const legacyAvatar = doctor.avatarUrl?.trim() && /^https?:\/\//i.test(doctor.avatarUrl.trim());
  const avatarUrl =
    hasAvatarFile || doctor.avatarUrl === AVATAR_PUBLIC_URL
      ? AVATAR_PUBLIC_URL
      : legacyAvatar
        ? (doctor.avatarUrl ?? "").trim()
        : "";

  const diplomas = doctor.doctorDiplomas.map((d) => ({
    id: d.id,
    title: d.title,
    issuedBy: d.issuedBy,
    year: d.year,
    fileUrl: /^https?:\/\//i.test(d.filePath) ? d.filePath : `/api/doctor/files/diploma/${d.id}`,
  }));
  const meta = parseDoctorMeta(doctor.doctorSymptoms);

  return NextResponse.json(
    {
      profile: {
        avatarUrl,
        doctorBio: doctor.doctorBio ?? "",
        symptoms: meta.symptoms,
        diseases: meta.diseases,
        education: meta.education,
        sessionPrice: meta.sessionPrice,
        diplomas,
      },
    },
    { status: 200 },
  );
}

export async function PATCH(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
    }

    const doctorBio = normalizeOptionalString(formData.get("doctorBio"));
    const symptomsRaw = formData.get("symptoms");
    const symptoms = typeof symptomsRaw === "string" ? splitCsvValues(symptomsRaw) : [];
    if (!hasOnlyAllowedValues(symptoms, ALLOWED_SYMPTOMS_SET)) {
      return NextResponse.json({ message: "Симптомы должны быть выбраны только из списка." }, { status: 400 });
    }
    const diseasesRaw = formData.get("diseases");
    const diseases = typeof diseasesRaw === "string" ? splitCsvValues(diseasesRaw) : [];
    if (!hasOnlyAllowedValues(diseases, ALLOWED_DISEASES_SET)) {
      return NextResponse.json(
        { message: "Заболевания должны быть выбраны только из списка." },
        { status: 400 },
      );
    }
    const educationRaw = formData.get("educationMeta");
    const education = parseEducationMeta(educationRaw);
    if (education === null) {
      return NextResponse.json({ message: "Некорректные данные образования." }, { status: 400 });
    }
    const sessionPrice = normalizeSessionPrice(formData.get("sessionPrice"));
    if (formData.get("sessionPrice") != null && formData.get("sessionPrice") !== "" && sessionPrice === null) {
      return NextResponse.json(
        { message: "Цена за сеанс должна быть целым числом от 1 до 1000000." },
        { status: 400 },
      );
    }

    const metaRaw = formData.get("diplomasMeta");
    const meta = parseDiplomasMeta(metaRaw);
    if (meta === null) {
      return NextResponse.json({ message: "Некорректные данные дипломов." }, { status: 400 });
    }

    const newFiles = formData
      .getAll("newDiploma")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    let newFileIndex = 0;

    const existingRows = await prisma.doctorDiploma.findMany({
      where: { doctorId: sessionUser.id },
      select: { id: true, filePath: true },
    });
    const keepIds = new Set(meta.filter((m) => m.id != null).map((m) => m.id as number));

    for (const row of existingRows) {
      if (!keepIds.has(row.id)) {
        if (row.filePath && !/^https?:\/\//i.test(row.filePath)) {
          try {
            await unlinkIfExists(absoluteDoctorFilePath(sessionUser.id, row.filePath));
          } catch {
            // ignore
          }
        }
        await prisma.doctorDiploma.delete({ where: { id: row.id } });
      }
    }

    for (const item of meta) {
      if (item.id != null) {
        const existing = await prisma.doctorDiploma.findFirst({
          where: { id: item.id, doctorId: sessionUser.id },
        });
        if (!existing) {
          return NextResponse.json({ message: "Диплом не найден." }, { status: 400 });
        }
        const replace = formData.get(`replace_${item.id}`);
        let nextPath = existing.filePath;
        if (replace instanceof File && replace.size > 0) {
          if (!/^https?:\/\//i.test(existing.filePath)) {
            try {
              await unlinkIfExists(absoluteDoctorFilePath(sessionUser.id, existing.filePath));
            } catch {
              // ignore
            }
          }
          try {
            nextPath = await saveDiplomaPdfFile(sessionUser.id, replace);
          } catch (error) {
            const code = error instanceof Error ? error.message : "";
            if (code === "INVALID_PDF_TYPE") {
              return NextResponse.json({ message: "Диплом должен быть в формате PDF." }, { status: 400 });
            }
            if (code === "INVALID_PDF_SIZE") {
              return NextResponse.json({ message: "PDF слишком большой (максимум 25 МБ)." }, { status: 400 });
            }
            return NextResponse.json({ message: "Не удалось сохранить PDF диплома." }, { status: 500 });
          }
        }
        await prisma.doctorDiploma.update({
          where: { id: item.id },
          data: {
            title: item.title,
            issuedBy: item.issuedBy ?? null,
            year: item.year ?? null,
            filePath: nextPath,
          },
        });
      } else {
        const file = newFiles[newFileIndex];
        newFileIndex += 1;
        if (!(file instanceof File) || file.size === 0) {
          return NextResponse.json(
            { message: "Для каждого нового диплома прикрепите PDF-файл." },
            { status: 400 },
          );
        }
        let relative: string;
        try {
          relative = await saveDiplomaPdfFile(sessionUser.id, file);
        } catch (error) {
          const code = error instanceof Error ? error.message : "";
          if (code === "INVALID_PDF_TYPE") {
            return NextResponse.json({ message: "Диплом должен быть в формате PDF." }, { status: 400 });
          }
          if (code === "INVALID_PDF_SIZE") {
            return NextResponse.json({ message: "PDF слишком большой (максимум 25 МБ)." }, { status: 400 });
          }
          return NextResponse.json({ message: "Не удалось сохранить PDF диплома." }, { status: 500 });
        }
        await prisma.doctorDiploma.create({
          data: {
            doctorId: sessionUser.id,
            title: item.title,
            issuedBy: item.issuedBy ?? null,
            year: item.year ?? null,
            filePath: relative,
          },
        });
      }
    }

    if (newFileIndex !== newFiles.length) {
      return NextResponse.json({ message: "Лишние файлы дипломов." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        doctorBio,
        doctorSymptoms: { symptoms, diseases, education, sessionPrice },
      },
    });

    return NextResponse.json({ message: "Профиль врача обновлен." }, { status: 200 });
  }

  const body = (await req.json().catch(() => null)) as JsonPayload | null;
  if (!body) {
    return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
  }

  const doctorBio = normalizeOptionalString(body.doctorBio);
  const symptoms = normalizeSymptoms(body.symptoms);
  if (!hasOnlyAllowedValues(symptoms, ALLOWED_SYMPTOMS_SET)) {
    return NextResponse.json({ message: "Симптомы должны быть выбраны только из списка." }, { status: 400 });
  }
  const diseases = normalizeDiseases(body.diseases);
  if (!hasOnlyAllowedValues(diseases, ALLOWED_DISEASES_SET)) {
    return NextResponse.json(
      { message: "Заболевания должны быть выбраны только из списка." },
      { status: 400 },
    );
  }
  const education = normalizeEducation(body.education);
  const sessionPrice = normalizeSessionPrice(body.sessionPrice);
  if (body.sessionPrice !== undefined && body.sessionPrice !== null && body.sessionPrice !== "" && sessionPrice === null) {
    return NextResponse.json(
      { message: "Цена за сеанс должна быть целым числом от 1 до 1000000." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      doctorBio,
      doctorSymptoms: { symptoms, diseases, education, sessionPrice },
    },
  });

  return NextResponse.json({ message: "Данные профиля обновлены." }, { status: 200 });
}
