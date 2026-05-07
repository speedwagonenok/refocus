import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { validatePdfMagic } from "@/lib/doctorUploads";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const PATIENT_DOCUMENTS_ROOT = path.join(process.cwd(), "uploads", "patients");

function patientRootDir(patientId: number): string {
  return path.join(PATIENT_DOCUMENTS_ROOT, String(patientId));
}

function patientDocumentsDir(patientId: number): string {
  return path.join(patientRootDir(patientId), "documents");
}

export function patientDocumentRelativePath(filename: string): string {
  return path.posix.join("documents", filename);
}

export function absolutePatientFilePath(patientId: number, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    throw new Error("Invalid stored path.");
  }
  return path.join(patientRootDir(patientId), normalized);
}

export async function savePatientDocumentPdfFile(patientId: number, file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES) {
    throw new Error("INVALID_PDF_SIZE");
  }
  if (!validatePdfMagic(buffer)) {
    throw new Error("INVALID_PDF_TYPE");
  }

  await fs.mkdir(patientDocumentsDir(patientId), { recursive: true });
  const filename = `${randomUUID()}.pdf`;
  const full = path.join(patientDocumentsDir(patientId), filename);
  await fs.writeFile(full, buffer);
  return patientDocumentRelativePath(filename);
}
