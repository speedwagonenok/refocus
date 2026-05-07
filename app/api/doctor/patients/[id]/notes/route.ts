import { AppointmentStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { savePatientNotePdfFile } from "@/lib/patientNotesUploads";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

async function hasDoctorPatientAccess(doctorId: number, patientId: number): Promise<boolean> {
  const relation = await prisma.appointment.findFirst({
    where: {
      doctorId,
      patientId,
      status: AppointmentStatus.CONFIRMED,
    },
    select: { id: true },
  });
  return Boolean(relation);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { id } = await params;
  const patientId = Number(id);
  if (!Number.isInteger(patientId) || patientId < 1) {
    return NextResponse.json({ message: "Некорректный идентификатор пациента." }, { status: 400 });
  }

  if (!(await hasDoctorPatientAccess(sessionUser.id, patientId))) {
    return NextResponse.json({ message: "Нет доступа к карточке пациента." }, { status: 403 });
  }

  const notes = await prisma.patientNote.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      filePath: true,
      fileName: true,
      createdAt: true,
      updatedAt: true,
      doctor: {
        select: {
          fullName: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      notes: notes.map((note) => ({
        id: note.id,
        content: note.content,
        fileName: note.fileName ?? (note.filePath ? "Заметка.pdf" : null),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        doctorFullName: note.doctor.fullName,
      })),
    },
    { status: 200 },
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.DOCTOR) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { id } = await params;
  const patientId = Number(id);
  if (!Number.isInteger(patientId) || patientId < 1) {
    return NextResponse.json({ message: "Некорректный идентификатор пациента." }, { status: 400 });
  }

  if (!(await hasDoctorPatientAccess(sessionUser.id, patientId))) {
    return NextResponse.json({ message: "Нет доступа к карточке пациента." }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "Прикрепите PDF файл заметки." }, { status: 400 });
  }

  let filePath: string;
  try {
    filePath = await savePatientNotePdfFile(patientId, file);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_PDF_TYPE") {
      return NextResponse.json({ message: "Заметка должна быть в формате PDF." }, { status: 400 });
    }
    if (code === "INVALID_PDF_SIZE") {
      return NextResponse.json({ message: "PDF слишком большой (максимум 25 МБ)." }, { status: 400 });
    }
    return NextResponse.json({ message: "Не удалось сохранить заметку." }, { status: 500 });
  }

  await prisma.patientNote.create({
    data: {
      doctorId: sessionUser.id,
      patientId,
      content: null,
      filePath,
      fileName: file.name.trim() || "Заметка.pdf",
    },
  });

  return NextResponse.json({ message: "Заметка прикреплена." }, { status: 201 });
}
