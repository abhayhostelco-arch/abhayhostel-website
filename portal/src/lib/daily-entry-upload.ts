export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

export const evidenceFileTypeMessage = "This file type is not supported. Choose a JPG, PNG, or WebP image. PDF files cannot be uploaded.";
export const evidenceEmptyMessage = "The selected image is empty. Choose another JPG, PNG, or WebP image.";
export const evidenceUnreadableMessage = "This image could not be read. Choose a valid JPG, PNG, or WebP image.";
export const evidenceRequiredMessage = "Select a Maha Mantra image before saving a late or absent entry.";
export const evidencePurgedMessage = "Maha Mantra image was automatically deleted after 7 days to reduce storage costs.";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type UploadError = {
  code?: string;
  message?: string;
  status?: number | string;
  statusCode?: number | string;
  name?: string;
  originalError?: UploadError;
  cause?: UploadError;
};

async function decodeInBrowser(file: File): Promise<void> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.onload = () => { URL.revokeObjectURL(url); resolve(); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode failed")); };
    image.src = url;
  });
}

async function imageTypeFromSignature(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const webp = bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (jpeg) return "image/jpeg";
  if (png) return "image/png";
  if (webp) return "image/webp";
  return null;
}

export async function validateEvidenceFile(
  file: File,
  decode: (file: File) => Promise<void> = decodeInBrowser,
): Promise<string | null> {
  if (file.size === 0) return evidenceEmptyMessage;
  if (file.size > MAX_EVIDENCE_BYTES) {
    return `This image is ${(file.size / 1024 / 1024).toFixed(2)} MB. The maximum allowed size is 5 MB. Choose a smaller image.`;
  }
  if (!supportedTypes.has(file.type)) return evidenceFileTypeMessage;
  try {
    if (await imageTypeFromSignature(file) !== file.type) return evidenceUnreadableMessage;
    await decode(file);
    return null;
  } catch {
    return evidenceUnreadableMessage;
  }
}

export function classifyEvidenceUploadError(error: UploadError): string {
  const code = String(error.code ?? error.name ?? "").toUpperCase();
  const rawStatus = error.statusCode ?? error.status;
  const status = rawStatus === undefined ? undefined : Number(rawStatus);
  const nestedCode = String(error.originalError?.code ?? error.originalError?.name ?? error.cause?.code ?? error.cause?.name ?? "").toUpperCase();
  if (code === "UPLOAD_TIMEOUT" || code === "ABORTERROR") {
    return "The image upload timed out. Your form data is preserved; try again on a stable connection.";
  }
  if (status === 0 || code.includes("NETWORK") || code === "TYPEERROR" || nestedCode.includes("NETWORK") || nestedCode === "TYPEERROR") {
    return "The image could not be uploaded because the network connection was lost. Your form data is preserved; reconnect and try again.";
  }
  if (status === 401 || code.includes("JWT") || code.includes("TOKEN")) {
    return "Your session expired before the image could be uploaded. Your form data is preserved; sign in again and retry.";
  }
  if (status === 403 || code.includes("ACCESS_DENIED") || code.includes("PERMISSION")) {
    return "The portal is not authorized to upload this image. Your form data is preserved; contact the administrator.";
  }
  if (status === 404 || (status !== undefined && status >= 500) || code.includes("BUCKET") || code.includes("SERVICE_UNAVAILABLE")) {
    return "Maha Mantra image storage is currently unavailable. Your form data is preserved; try again later.";
  }
  return "The image storage service rejected the upload. Your form data is preserved; try another image or contact the administrator.";
}

export async function withEvidenceUploadTimeout<T>(operation: Promise<T>, timeoutMs = 30_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("Upload timed out"), { code: "UPLOAD_TIMEOUT" })), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
