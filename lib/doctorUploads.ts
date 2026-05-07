import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export const DOCTOR_UPLOAD_ROOT = path.join(process.cwd(), "uploads", "doctors");

export function doctorRootDir(doctorId: number): string {
  return path.join(DOCTOR_UPLOAD_ROOT, String(doctorId));
}

export function doctorDiplomasDir(doctorId: number): string {
  return path.join(doctorRootDir(doctorId), "diplomas");
}

export async function ensureDoctorUploadDirs(doctorId: number): Promise<void> {
  await fs.mkdir(doctorDiplomasDir(doctorId), { recursive: true });
}

export function diplomaRelativePath(filename: string): string {
  return path.posix.join("diplomas", filename);
}

export function absoluteDoctorFilePath(doctorId: number, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    throw new Error("Invalid stored path.");
  }
  return path.join(doctorRootDir(doctorId), normalized);
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** Только JPEG по сигнатуре SOI (FFD8FF). */
export function validateJpegMagic(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export function validatePdfMagic(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export async function readAvatarFile(doctorId: number): Promise<{ buffer: Buffer; ext: string } | null> {
  const root = doctorRootDir(doctorId);
  try {
    const names = await fs.readdir(root);
    const avatar = names.find((n) => n.startsWith("avatar."));
    if (!avatar) return null;
    const buffer = await fs.readFile(path.join(root, avatar));
    const ext = avatar.slice("avatar.".length);
    return { buffer, ext };
  } catch {
    return null;
  }
}

export async function saveAvatarFile(doctorId: number, file: File): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
    throw new Error("INVALID_AVATAR_SIZE");
  }
  if (!validateJpegMagic(buffer)) {
    throw new Error("INVALID_AVATAR_TYPE");
  }
  await fs.mkdir(doctorRootDir(doctorId), { recursive: true });
  const root = doctorRootDir(doctorId);
  let existing: string[] = [];
  try {
    existing = await fs.readdir(root);
  } catch {
    existing = [];
  }
  for (const name of existing) {
    if (name.startsWith("avatar.")) {
      await fs.unlink(path.join(root, name)).catch(() => undefined);
    }
  }
  await fs.writeFile(path.join(root, "avatar.jpg"), buffer);
}

export async function saveDiplomaPdfFile(doctorId: number, file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0 || buffer.length > MAX_PDF_BYTES) {
    throw new Error("INVALID_PDF_SIZE");
  }
  if (!validatePdfMagic(buffer)) {
    throw new Error("INVALID_PDF_TYPE");
  }
  await ensureDoctorUploadDirs(doctorId);
  const filename = `${randomUUID()}.pdf`;
  const full = path.join(doctorDiplomasDir(doctorId), filename);
  await fs.writeFile(full, buffer);
  return diplomaRelativePath(filename);
}

export async function unlinkIfExists(absolutePath: string): Promise<void> {
  try {
    await fs.unlink(absolutePath);
  } catch {
    // ignore
  }
}
