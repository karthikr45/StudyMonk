import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { env } from './env';

let client: S3Client | null = null;

function r2() {
  if (client) return client;
  const e = env();
  client = new S3Client({
    region: 'auto',
    endpoint: e.R2_ENDPOINT,
    credentials: {
      accessKeyId: e.R2_ACCESS_KEY_ID,
      secretAccessKey: e.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

/** Build a namespaced object key so uploads never collide. */
export function buildStorageKey(prefix: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const clean = prefix.replace(/^\/+|\/+$/g, '');
  return `${clean}/${randomUUID()}-${safe}`;
}

/** Presigned PUT URL the browser uses to upload directly to R2. */
export async function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 600,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env().R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2(), cmd, { expiresIn });
}

/** Presigned GET URL for reading/downloading a stored object. */
export async function presignDownload(
  key: string,
  expiresIn = 600,
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: env().R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2(), cmd, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(
    new DeleteObjectCommand({ Bucket: env().R2_BUCKET_NAME, Key: key }),
  );
}

/** Download an object's bytes (used for server-side PDF text extraction). */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await r2().send(
    new GetObjectCommand({ Bucket: env().R2_BUCKET_NAME, Key: key }),
  );
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}
