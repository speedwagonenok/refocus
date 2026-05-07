import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { readAvatarFile } from "@/lib/doctorUploads";
import { parseDoctorMatchMeta, unwrapDoctorSymptomsJson } from "@/lib/doctorSymptomsJson";
import { prisma } from "@/lib/prisma";
import { ALLOWED_PATIENT_SYMPTOM_SET } from "@/lib/psychotherapyPresets";
import { getSessionUser } from "@/lib/sessionUser";

type Body = { symptoms?: unknown };

function normalizePatientSymptoms(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEducation(raw: unknown): Array<{ when: string; institution: string; specialty: string }> {
  const data = unwrapDoctorSymptomsJson(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }
  const source = (data as Record<string, unknown>).education;
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      when: typeof row.when === "string" ? row.when.trim() : "",
      institution: typeof row.institution === "string" ? row.institution.trim() : "",
      specialty: typeof row.specialty === "string" ? row.specialty.trim() : "",
    }))
    .filter((row) => row.when && row.institution && row.specialty);
}

export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.PATIENT) {
    return NextResponse.json({ message: "Доступ запрещён." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const symptoms = normalizePatientSymptoms(body?.symptoms);
  if (symptoms.length === 0) {
    return NextResponse.json({ message: "Укажите хотя бы один симптом." }, { status: 400 });
  }
  for (const s of symptoms) {
    if (!ALLOWED_PATIENT_SYMPTOM_SET.has(s)) {
      return NextResponse.json({ message: "Некорректный список симптомов." }, { status: 400 });
    }
  }

  const doctors = await prisma.user.findMany({
    where: { role: Role.DOCTOR },
    select: {
      id: true,
      fullName: true,
      doctorBio: true,
      doctorSymptoms: true,
    },
  });

  const out: Array<{
    id: number;
    fullName: string;
    doctorBio: string | null;
    hasAvatar: boolean;
    matchedSymptoms: string[];
    profileSymptoms: string[];
    profileDiseases: string[];
    profileEducation: Array<{ when: string; institution: string; specialty: string }>;
    sessionPrice: number | null;
    diplomas: Array<{ id: number; title: string; issuedBy: string | null; year: number | null }>;
  }> = [];

  for (const d of doctors) {
    const meta = parseDoctorMatchMeta(d.doctorSymptoms);
    const docSymptoms = meta.symptoms;
    const docPool = new Set<string>(docSymptoms);
    const matchedSymptoms = symptoms.filter((p) => docPool.has(p));
    if (matchedSymptoms.length === 0) {
      continue;
    }
    const avatarFile = await readAvatarFile(d.id);
    out.push({
      id: d.id,
      fullName: d.fullName,
      doctorBio: d.doctorBio?.trim() ? d.doctorBio.trim() : null,
      hasAvatar: avatarFile != null,
      matchedSymptoms,
      profileSymptoms: [...docSymptoms],
      profileDiseases: [...meta.diseases],
      profileEducation: parseEducation(d.doctorSymptoms),
      sessionPrice: meta.sessionPrice,
      diplomas: [],
    });
  }

  out.sort((a, b) => b.matchedSymptoms.length - a.matchedSymptoms.length || a.fullName.localeCompare(b.fullName));

  const matchedIds = out.map((o) => o.id);
  if (matchedIds.length > 0) {
    const diplomaRows = await prisma.doctorDiploma.findMany({
      where: { doctorId: { in: matchedIds } },
      orderBy: { createdAt: "desc" },
      select: { id: true, doctorId: true, title: true, issuedBy: true, year: true },
    });
    const byDoctor = new Map<number, Array<{ id: number; title: string; issuedBy: string | null; year: number | null }>>();
    for (const row of diplomaRows) {
      const list = byDoctor.get(row.doctorId) ?? [];
      list.push({
        id: row.id,
        title: row.title,
        issuedBy: row.issuedBy,
        year: row.year,
      });
      byDoctor.set(row.doctorId, list);
    }
    for (const row of out) {
      row.diplomas = byDoctor.get(row.id) ?? [];
    }
  }

  return NextResponse.json({ doctors: out });
}
