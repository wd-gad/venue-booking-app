import { integer, jsonb, pgTable, text, timestamp, uuid, varchar, doublePrecision, date, index } from "drizzle-orm/pg-core";
import type { VenueNote } from "@/lib/types";

export const venueStatusEnum = ["booked", "candidate"] as const;

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("user_id"),
    name: text("name").notNull(),
    address: text("address").notNull(),
    eventDate: date("event_date").notNull(),
    fee: integer("fee").notNull(),
    status: varchar("status", { length: 24 }).notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    contactTel: text("contact_tel").notNull().default(""),
    contactFax: text("contact_fax").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    permitFilePath: text("permit_file_path"),
    permitFileName: text("permit_file_name"),
    conversationNotes: jsonb("conversation_notes").$type<VenueNote[]>().notNull().default([]),
    editorEmail: text("editor_email").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventDateIdx: index("venues_event_date_idx").on(table.eventDate),
    statusIdx: index("venues_status_idx").on(table.status),
  }),
);

export const venueDocuments = pgTable(
  "venue_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    venueIdIdx: index("venue_documents_venue_id_idx").on(table.venueId),
  }),
);
