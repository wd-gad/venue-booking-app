import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getStorageRoot } from "@/lib/storage/local";
import { resolveVenueDocumentUrl } from "@/lib/storage";

type Params = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { path: segments } = await params;

  if (!segments.length || segments.some((segment) => segment === "..")) {
    return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
  }

  const storagePath = segments.join("/");
  const externalUrl = await resolveVenueDocumentUrl(storagePath);

  if (externalUrl) {
    return NextResponse.redirect(externalUrl);
  }

  const absolutePath = path.join(getStorageRoot(), ...segments);

  try {
    await access(absolutePath);
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const fileStream = createReadStream(absolutePath);

  return new NextResponse(fileStream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
