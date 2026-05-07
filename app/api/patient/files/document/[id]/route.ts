import { Role } from "@prisma/client";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";

import { absolutePatientFilePath } from "@/lib/patientDocumentsUploads";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.PATIENT) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ message: "Некорректный идентификатор." }, { status: 400 });
  }

  const document = await prisma.patientDocument.findFirst({
    where: { id: documentId, patientId: sessionUser.id },
    select: { filePath: true },
  });
  if (!document) {
    return NextResponse.json({ message: "Документ не найден." }, { status: 404 });
  }

  let absolute: string;
  try {
    absolute = absolutePatientFilePath(sessionUser.id, document.filePath);
  } catch {
    return NextResponse.json({ message: "Некорректный путь к файлу." }, { status: 400 });
  }

  try {
    const buffer = await fs.readFile(absolute);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="patient-document-${documentId}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ message: "Файл не найден на сервере." }, { status: 404 });
  }
}
