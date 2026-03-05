import { saveVenueDocument as saveVenueDocumentLocally } from "@/lib/storage/local";
import {
  getVenueDocumentSignedUrl,
  hasOciObjectStorageConfig,
  saveVenueDocumentToOci,
} from "@/lib/storage/oci";

type SaveVenueDocumentParams = {
  fileName: string;
  fileBuffer: Buffer;
  venueId: string;
  userId: string;
};

export async function saveVenueDocument(params: SaveVenueDocumentParams) {
  if (hasOciObjectStorageConfig()) {
    return saveVenueDocumentToOci(params);
  }

  return saveVenueDocumentLocally(params);
}

export async function resolveVenueDocumentUrl(storagePath: string) {
  if (hasOciObjectStorageConfig()) {
    return getVenueDocumentSignedUrl(storagePath);
  }

  return null;
}

export { hasOciObjectStorageConfig } from "@/lib/storage/oci";
