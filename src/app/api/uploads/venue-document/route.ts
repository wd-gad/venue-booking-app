import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server";
import { saveVenueDocument } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getAuthUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const venueId = formData.get("venueId");
  const file = formData.get("file");

  if (typeof venueId !== "string" || !venueId) {
    return NextResponse.json({ error: "venueId is required." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const result = await saveVenueDocument({
    fileName: file.name,
    fileBuffer,
    venueId,
    userId: user.id,
  });

  return NextResponse.json({
    storagePath: result.storagePath,
    fileName: result.fileName,
    publicUrl: `/api/files/${result.storagePath}`,
  });
}
