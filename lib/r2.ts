import "server-only";
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REQUIRED_R2_ENV = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
] as const;

type R2EnvName = (typeof REQUIRED_R2_ENV)[number];

export type R2Status =
  | { configured: true; missing: [] }
  | { configured: false; missing: R2EnvName[] };

let client: S3Client | null = null;

export function getR2Status(): R2Status {
  const missing = REQUIRED_R2_ENV.filter((name) => !process.env[name]?.trim());
  return missing.length === 0
    ? { configured: true, missing: [] }
    : { configured: false, missing };
}

export function isR2Configured(): boolean {
  return getR2Status().configured;
}

export function hasR2PublicBaseUrl(): boolean {
  return Boolean(process.env.R2_PUBLIC_BASE_URL?.trim());
}

function requireR2Config() {
  const status = getR2Status();
  if (!status.configured) {
    throw new Error(`Webtoon storage is not configured. Missing: ${status.missing.join(", ")}`);
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID!.trim(),
    accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    bucket: process.env.R2_BUCKET_NAME!.trim(),
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL!.trim().replace(/\/+$/, ""),
  };
}

function getR2Client(): S3Client {
  const config = requireR2Config();
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return client;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function createWebtoonObjectKey(
  bookId: string,
  chapterId: string,
  mimeType: string
): string {
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw new Error("Unsupported webtoon image type");
  return `webtoons/${bookId}/${chapterId}/${crypto.randomUUID()}.${extension}`;
}

export function webtoonObjectPrefix(bookId: string, chapterId: string): string {
  return `webtoons/${bookId}/${chapterId}/`;
}

export function getR2PublicUrl(objectKey: string): string {
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!publicBaseUrl) throw new Error("Webtoon artwork URL is not configured.");
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return `${publicBaseUrl}/${encodedKey}`;
}

export async function createR2UploadUrl(
  objectKey: string,
  contentType: string,
  expiresIn = 10 * 60
): Promise<string> {
  const { bucket } = requireR2Config();
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType }),
    { expiresIn }
  );
}

export async function verifyR2Object(objectKey: string): Promise<{
  contentType: string;
  byteSize: number;
}> {
  const { bucket } = requireR2Config();
  const response = await getR2Client().send(
    new HeadObjectCommand({ Bucket: bucket, Key: objectKey })
  );
  return {
    contentType: response.ContentType ?? "",
    byteSize: Number(response.ContentLength ?? 0),
  };
}

export async function deleteR2Objects(objectKeys: string[]): Promise<void> {
  if (objectKeys.length === 0) return;
  const { bucket } = requireR2Config();
  for (let index = 0; index < objectKeys.length; index += 1000) {
    const batch = objectKeys.slice(index, index + 1000);
    const response = await getR2Client().send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    );
    if (response.Errors?.length) {
      throw new Error(
        `Could not delete ${response.Errors.length} webtoon image${response.Errors.length === 1 ? "" : "s"} from R2.`
      );
    }
  }
}
