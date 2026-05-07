import { Role } from "@prisma/client";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";

import { absoluteDoctorFilePath } from "@/lib/doctorUploads";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { id } = await params;
  const diplomaId = Number(id);
  if (!Number.isInteger(diplomaId) || diplomaId <= 0) {
    return NextResponse.json({ message: "Некорректный идентификатор." }, { status: 400 });
  }

  const diploma = await prisma.doctorDiploma.findFirst({
    where: { id: diplomaId, doctorId: sessionUser.id },
    select: { filePath: true },
  });
  if (!diploma) {
    return NextResponse.json({ message: "Диплом не найден." }, { status: 404 });
  }

  if (/^https?:\/\//i.test(diploma.filePath)) {
    return NextResponse.redirect(diploma.filePath);
  }

  let absolute: string;
  try {
    absolute = absoluteDoctorFilePath(sessionUser.id, diploma.filePath);
  } catch {
    return NextResponse.json({ message: "Некорректный путь к файлу." }, { status: 400 });
  }

  try {
    const buffer = await fs.readFile(absolute);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="diploma-${diplomaId}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ message: "Файл диплома не найден на сервере." }, { status: 404 });
  }
}
