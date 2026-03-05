export type VenueStatus = "booked" | "candidate";
export type VenueNote = {
  id: string;
  speaker: string;
  author_email?: string | null;
  statement: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  liked_by?: string[];
};

export type Venue = {
  id: string;
  name: string;
  address: string;
  event_date: string;
  fee: number;
  status: VenueStatus;
  lat: number;
  lng: number;
  contact_tel: string;
  contact_fax: string;
  contact_email: string;
  permit_file_path: string | null;
  permit_file_name: string | null;
  conversation_notes: VenueNote[];
  editor_email: string;
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type VenueInput = Omit<Venue, "id" | "user_id" | "editor_email" | "created_at" | "updated_at">;
