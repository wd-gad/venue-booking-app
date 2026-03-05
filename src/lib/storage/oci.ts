import { randomUUID } from "node:crypto";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type OciObjectStorageConfig = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  region: string;
  secretAccessKey: string;
};

function getOciObjectStorageConfig(): OciObjectStorageConfig | null {
  const accessKeyId = process.env.OCI_S3_ACCESS_KEY_ID;
  const bucket = process.env.OCI_S3_BUCKET;
  const endpoint = process.env.OCI_S3_ENDPOINT;
  const region = process.env.OCI_S3_REGION;
  const secretAccessKey = process.env.OCI_S3_SECRET_ACCESS_KEY;

  if (!accessKeyId || !bucket || !endpoint || !region || !secretAccessKey) {
    return null;
  }

  return {
    accessKeyId,
    bucket,
    endpoint,
    region,
    secretAccessKey,
  };
}

export function hasOciObjectStorageConfig() {
  return Boolean(getOciObjectStorageConfig());
}

function createOciS3Client(config: OciObjectStorageConfig) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function buildStoragePath(params: { fileName: string; venueId: string; userId: string }) {
  const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relativeDir = path.posix.join("venue-documents", params.userId, params.venueId);
  const finalFileName = `${Date.now()}-${randomUUID()}-${safeFileName}`;

  return path.posix.join(relativeDir, finalFileName);
}

export async function saveVenueDocumentToOci(params: {
  fileName: string;
  fileBuffer: Buffer;
  venueId: string;
  userId: string;
}) {
  const config = getOciObjectStorageConfig();

  if (!config) {
    throw new Error("OCI Object Storage is not configured.");
  }

  const client = createOciS3Client(config);
  const storagePath = buildStoragePath(params);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storagePath,
      Body: params.fileBuffer,
      ContentType: "application/pdf",
    }),
  );

  return {
    storagePath,
    fileName: params.fileName,
  };
}

export async function getVenueDocumentSignedUrl(storagePath: string) {
  const config = getOciObjectStorageConfig();

  if (!config) {
    throw new Error("OCI Object Storage is not configured.");
  }

  const client = createOciS3Client(config);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: storagePath,
    }),
    { expiresIn: 60 * 60 },
  );
}
