import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { readAvatarFile } from "@/lib/doctorUploads";
import { parseDoctorMatchMeta, unwrapDoctorSymptomsJson } from "@/lib/doctorSymptomsJson";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

type DiplomaOut = { id: number; title: string; issuedBy: string | null; year: number | null };
type EducationOut = { when: string; institution: string; specialty: string };

function parseEducation(raw: unknown): EducationOut[] {
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

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.PATIENT) {
    return NextResponse.json({ message: "Доступ запрещён." }, { status: 403 });
  }

  const doctors = await prisma.user.findMany({
    where: { role: Role.DOCTOR },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      doctorBio: true,
      doctorSymptoms: true,
    },
  });

  const ids = doctors.map((d) => d.id);

  const diplomaByDoctor = new Map<number, DiplomaOut[]>();
  if (ids.length > 0) {
    const diplomaRows = await prisma.doctorDiploma.findMany({
      where: { doctorId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { id: true, doctorId: true, title: true, issuedBy: true, year: true },
    });
    for (const row of diplomaRows) {
      const list = diplomaByDoctor.get(row.doctorId) ?? [];
      list.push({
        id: row.id,
        title: row.title,
        issuedBy: row.issuedBy,
        year: row.year,
      });
      diplomaByDoctor.set(row.doctorId, list);
    }
  }

  const hasAvatarById = new Map<number, boolean>();
  await Promise.all(
    ids.map(async (id) => {
      hasAvatarById.set(id, (await readAvatarFile(id)) != null);
    }),
  );

  const out = doctors.map((d) => {
    const meta = parseDoctorMatchMeta(d.doctorSymptoms);
    return {
      id: d.id,
      fullName: d.fullName,
      doctorBio: d.doctorBio?.trim() ? d.doctorBio.trim() : null,
      hasAvatar: hasAvatarById.get(d.id) ?? false,
      matchedSymptoms: [] as string[],
      profileSymptoms: [...meta.symptoms],
      profileDiseases: [...meta.diseases],
      profileEducation: parseEducation(d.doctorSymptoms),
      sessionPrice: meta.sessionPrice,
      diplomas: diplomaByDoctor.get(d.id) ?? [],
    };
  });

  return NextResponse.json({ doctors: out });
}
