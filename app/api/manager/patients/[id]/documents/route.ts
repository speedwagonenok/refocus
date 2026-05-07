import { AppointmentStatus, PatientDocumentType, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { savePatientDocumentPdfFile } from "@/lib/patientDocumentsUploads";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

const ALLOWED_TYPES = new Set<PatientDocumentType>([
  PatientDocumentType.CONTRACT,
  PatientDocumentType.PRESCRIPTION,
  PatientDocumentType.VISIT_PROTOCOL,
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.MANAGER) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const { id } = await params;
  const patientId = Number(id);
  if (!Number.isInteger(patientId) || patientId < 1) {
    return NextResponse.json({ message: "Некорректный идентификатор пациента." }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
  }

  const typeRaw = formData.get("type");
  const type =
    typeof typeRaw === "string" && ALLOWED_TYPES.has(typeRaw as PatientDocumentType)
      ? (typeRaw as PatientDocumentType)
      : null;
  if (!type) {
    return NextResponse.json({ message: "Выберите корректный тип документа." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "Прикрепите PDF-файл." }, { status: 400 });
  }

  const patient = await prisma.user.findFirst({
    where: { id: patientId, role: Role.PATIENT },
    select: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ message: "Пациент не найден." }, { status: 404 });
  }

  const hasConfirmedAppointments = await prisma.appointment.findFirst({
    where: {
      patientId,
      status: AppointmentStatus.CONFIRMED,
    },
    select: { id: true },
  });
  if (!hasConfirmedAppointments) {
    return NextResponse.json(
      { message: "Документы можно прикреплять только пациентам с подтвержденным приемом." },
      { status: 400 },
    );
  }

  let relativePath: string;
  try {
    relativePath = await savePatientDocumentPdfFile(patientId, file);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_PDF_TYPE") {
      return NextResponse.json({ message: "Документ должен быть в формате PDF." }, { status: 400 });
    }
    if (code === "INVALID_PDF_SIZE") {
      return NextResponse.json({ message: "PDF слишком большой (максимум 25 МБ)." }, { status: 400 });
    }
    return NextResponse.json({ message: "Не удалось сохранить документ." }, { status: 500 });
  }

  await prisma.patientDocument.create({
    data: {
      patientId,
      managerId: sessionUser.id,
      type,
      filePath: relativePath,
    },
  });

  return NextResponse.json({ message: "Документ прикреплен." }, { status: 201 });
}
