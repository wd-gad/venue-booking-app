import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { venues } from "@/lib/db/schema";
import type { Venue, VenueInput } from "@/lib/types";

type VenueRow = typeof venues.$inferSelect;
type VenueInsert = typeof venues.$inferInsert;

export async function listVenues() {
  const db = getDb();
  const rows = await db.select().from(venues).orderBy(asc(venues.eventDate));
  return rows.map(mapVenueRow);
}

export async function getVenueById(venueId: string) {
  const db = getDb();
  const [row] = await db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
  return row ? mapVenueRow(row) : null;
}

export async function createVenue(input: VenueInput & { editorEmail: string; ownerId?: string | null }) {
  const db = getDb();
  const [row] = await db
    .insert(venues)
    .values(mapVenueInsert(input))
    .returning();

  return mapVenueRow(row);
}

export async function updateVenue(
  venueId: string,
  input: Partial<VenueInput> & { editorEmail?: string; ownerId?: string | null },
) {
  const db = getDb();
  const updatePayload = mapVenueUpdate(input);

  const [row] = await db
    .update(venues)
    .set({
      ...updatePayload,
      updatedAt: new Date(),
    })
    .where(eq(venues.id, venueId))
    .returning();

  return row ? mapVenueRow(row) : null;
}

export async function deleteVenue(venueId: string) {
  const db = getDb();
  const [row] = await db.delete(venues).where(eq(venues.id, venueId)).returning();
  return row ? mapVenueRow(row) : null;
}

function mapVenueInsert(input: VenueInput & { editorEmail: string; ownerId?: string | null }): VenueInsert {
  return {
    ownerId: input.ownerId ?? null,
    name: input.name,
    address: input.address,
    eventDate: input.event_date,
    fee: input.fee,
    status: input.status,
    lat: input.lat,
    lng: input.lng,
    contactTel: input.contact_tel,
    contactFax: input.contact_fax,
    contactEmail: input.contact_email,
    permitFilePath: input.permit_file_path,
    permitFileName: input.permit_file_name,
    conversationNotes: input.conversation_notes,
    editorEmail: input.editorEmail,
  };
}

function mapVenueUpdate(
  input: Partial<VenueInput> & { editorEmail?: string; ownerId?: string | null },
): Partial<VenueInsert> {
  const values: Partial<VenueInsert> = {};

  if ("ownerId" in input) {
    values.ownerId = input.ownerId ?? null;
  }
  if ("name" in input) {
    values.name = input.name;
  }
  if ("address" in input) {
    values.address = input.address;
  }
  if ("event_date" in input) {
    values.eventDate = input.event_date;
  }
  if ("fee" in input) {
    values.fee = input.fee;
  }
  if ("status" in input) {
    values.status = input.status;
  }
  if ("lat" in input) {
    values.lat = input.lat;
  }
  if ("lng" in input) {
    values.lng = input.lng;
  }
  if ("contact_tel" in input) {
    values.contactTel = input.contact_tel;
  }
  if ("contact_fax" in input) {
    values.contactFax = input.contact_fax;
  }
  if ("contact_email" in input) {
    values.contactEmail = input.contact_email;
  }
  if ("permit_file_path" in input) {
    values.permitFilePath = input.permit_file_path;
  }
  if ("permit_file_name" in input) {
    values.permitFileName = input.permit_file_name;
  }
  if ("conversation_notes" in input) {
    values.conversationNotes = input.conversation_notes;
  }
  if ("editorEmail" in input) {
    values.editorEmail = input.editorEmail;
  }

  return values;
}

function mapVenueRow(row: VenueRow): Venue {
  return {
    id: row.id,
    user_id: row.ownerId,
    name: row.name,
    address: row.address,
    event_date: row.eventDate,
    fee: row.fee,
    status: row.status as Venue["status"],
    lat: row.lat,
    lng: row.lng,
    contact_tel: row.contactTel,
    contact_fax: row.contactFax,
    contact_email: row.contactEmail,
    permit_file_path: row.permitFilePath,
    permit_file_name: row.permitFileName,
    conversation_notes: row.conversationNotes,
    editor_email: row.editorEmail,
    created_at: row.createdAt?.toISOString(),
    updated_at: row.updatedAt?.toISOString(),
  };
}
