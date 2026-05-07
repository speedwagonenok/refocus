import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { validatePdfMagic } from "@/lib/doctorUploads";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const PATIENT_NOTES_ROOT = path.join(process.cwd(), "uploads", "patients");

function patientRootDir(patientId: number): string {
  return path.join(PATIENT_NOTES_ROOT, String(patientId));
}

function patientNotesDir(patientId: number): string {
  return path.join(patientRootDir(patientId), "notes");
}

export function patientNoteRelativePath(filename: string): string {
  return path.posix.join("notes", filename);
}

export function absolutePatientNoteFilePath(patientId: number, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    throw new Error("Invalid stored path.");
  }
  return path.join(patientRootDir(patientId), normalized);
}

export async function savePatientNotePdfFile(patientId: number, file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES) {
    throw new Error("INVALID_PDF_SIZE");
  }
  if (!validatePdfMagic(buffer)) {
    throw new Error("INVALID_PDF_TYPE");
  }

  await fs.mkdir(patientNotesDir(patientId), { recursive: true });
  const filename = `${randomUUID()}.pdf`;
  const full = path.join(patientNotesDir(patientId), filename);
  await fs.writeFile(full, buffer);
  return patientNoteRelativePath(filename);
}
