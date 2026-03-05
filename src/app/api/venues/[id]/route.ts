import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server";
import { deleteVenue, updateVenue } from "@/lib/db/repositories/venues";
import { hasDatabaseUrl } from "@/lib/db/env";
import type { VenueInput } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const user = await getAuthUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await request.json()) as Partial<VenueInput>;
  const venue = await updateVenue(id, {
    ...payload,
    editorEmail: user.email,
  });

  if (!venue) {
    return NextResponse.json({ error: "Venue not found." }, { status: 404 });
  }

  return NextResponse.json(venue);
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const user = await getAuthUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteVenue(id);

  if (!deleted) {
    return NextResponse.json({ error: "Venue not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
