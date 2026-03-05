import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_ROOT = path.join(process.cwd(), "uploads");

export async function saveVenueDocument(params: {
  fileName: string;
  fileBuffer: Buffer;
  venueId: string;
  userId: string;
}) {
  const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relativeDir = path.join("venue-documents", params.userId, params.venueId);
  const absoluteDir = path.join(STORAGE_ROOT, relativeDir);
  const finalFileName = `${Date.now()}-${randomUUID()}-${safeFileName}`;

  await mkdir(absoluteDir, { recursive: true });

  const relativePath = path.join(relativeDir, finalFileName);
  const absolutePath = path.join(STORAGE_ROOT, relativePath);

  await writeFile(absolutePath, params.fileBuffer);

  return {
    storagePath: relativePath.replaceAll(path.sep, "/"),
    fileName: params.fileName,
  };
}

export function getStorageRoot() {
  return STORAGE_ROOT;
}
