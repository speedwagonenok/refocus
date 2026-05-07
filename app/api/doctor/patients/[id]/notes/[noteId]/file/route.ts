import { AppointmentStatus, Role } from "@prisma/client";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";

import { absolutePatientNoteFilePath } from "@/lib/patientNotesUploads";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { id: patientIdRaw, noteId: noteIdRaw } = await params;
  const patientId = Number(patientIdRaw);
  const noteId = Number(noteIdRaw);
  if (!Number.isInteger(patientId) || patientId < 1 || !Number.isInteger(noteId) || noteId < 1) {
    return NextResponse.json({ message: "Некорректный идентификатор." }, { status: 400 });
  }

  const relation = await prisma.appointment.findFirst({
    where: {
      doctorId: sessionUser.id,
      patientId,
      status: AppointmentStatus.CONFIRMED,
    },
    select: { id: true },
  });
  if (!relation) {
    return NextResponse.json({ message: "Нет доступа к карточке пациента." }, { status: 403 });
  }

  const note = await prisma.patientNote.findFirst({
    where: { id: noteId, patientId },
    select: { filePath: true, fileName: true },
  });
  if (!note || !note.filePath) {
    return NextResponse.json({ message: "Файл заметки не найден." }, { status: 404 });
  }

  let absolute: string;
  try {
    absolute = absolutePatientNoteFilePath(patientId, note.filePath);
  } catch {
    return NextResponse.json({ message: "Некорректный путь к файлу." }, { status: 400 });
  }

  try {
    const buffer = await fs.readFile(absolute);
    const safeName = (note.fileName ?? "patient-note.pdf").replace(/"/g, "");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ message: "Файл заметки не найден на сервере." }, { status: 404 });
  }
}
