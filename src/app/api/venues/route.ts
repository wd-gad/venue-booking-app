import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server";
import { hasDatabaseUrl } from "@/lib/db/env";
import { createVenue, listVenues } from "@/lib/db/repositories/venues";
import type { VenueInput } from "@/lib/types";

export async function GET() {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const user = await getAuthUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const venues = await listVenues();
  return NextResponse.json(venues);
}

export async function POST(request: Request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const user = await getAuthUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as VenueInput;
  const venue = await createVenue({
    ...payload,
    ownerId: user.id,
    editorEmail: user.email,
  });

  return NextResponse.json(venue, { status: 201 });
}
