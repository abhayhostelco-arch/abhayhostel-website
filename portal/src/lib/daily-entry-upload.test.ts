import { describe, expect, it } from "vitest";
import {
  classifyEvidenceUploadError,
  validateEvidenceFile,
} from "@/lib/daily-entry-upload";

describe("daily-entry evidence validation", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  it.each([
    [new File([], "empty.jpg", { type: "image/jpeg" }), "The selected image is empty. Choose another JPG, PNG, or WebP image."],
    [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" }), "This image is 5.00 MB. The maximum allowed size is 5 MB. Choose a smaller image."],
    [new File(["pdf"], "proof.pdf", { type: "application/pdf" }), "This file type is not supported. Choose a JPG, PNG, or WebP image. PDF files cannot be uploaded."],
  ])("returns the exact message for invalid file metadata", async (file, message) => {
    await expect(validateEvidenceFile(file, async () => undefined)).resolves.toBe(message);
  });

  it("rejects image bytes that the browser cannot decode", async () => {
    const file = new File([jpeg], "broken.png", { type: "image/png" });

    await expect(validateEvidenceFile(file, async () => { throw new Error("decode failed"); })).resolves.toBe(
      "This image could not be read. Choose a valid JPG, PNG, or WebP image.",
    );
  });

  it("rejects a file whose declared image type does not have an allowed image signature", async () => {
    const file = new File(["GIF89a"], "spoofed.jpg", { type: "image/jpeg" });

    await expect(validateEvidenceFile(file, async () => undefined)).resolves.toBe(
      "This image could not be read. Choose a valid JPG, PNG, or WebP image.",
    );
  });

  it("rejects a valid image signature paired with the wrong declared type", async () => {
    const file = new File([jpeg], "wrong-type.png", { type: "image/png" });

    await expect(validateEvidenceFile(file, async () => undefined)).resolves.toBe(
      "This image could not be read. Choose a valid JPG, PNG, or WebP image.",
    );
  });
});

describe("daily-entry storage error classification", () => {
  it.each([
    [{ code: "NETWORK_ERROR", status: 0 }, "The image could not be uploaded because the network connection was lost. Your form data is preserved; reconnect and try again."],
    [{ name: "StorageUnknownError", originalError: { name: "TypeError" } }, "The image could not be uploaded because the network connection was lost. Your form data is preserved; reconnect and try again."],
    [{ code: "UPLOAD_TIMEOUT" }, "The image upload timed out. Your form data is preserved; try again on a stable connection."],
    [{ code: "JWT_EXPIRED", statusCode: 401 }, "Your session expired before the image could be uploaded. Your form data is preserved; sign in again and retry."],
    [{ code: "ACCESS_DENIED", statusCode: 403 }, "The portal is not authorized to upload this image. Your form data is preserved; contact the administrator."],
    [{ code: "BUCKET_NOT_FOUND", statusCode: 404 }, "Maha Mantra image storage is currently unavailable. Your form data is preserved; try again later."],
    [{ code: "SERVICE_UNAVAILABLE", statusCode: 503 }, "Maha Mantra image storage is currently unavailable. Your form data is preserved; try again later."],
    [{ code: "STORAGE_REJECTED", statusCode: 400 }, "The image storage service rejected the upload. Your form data is preserved; try another image or contact the administrator."],
    [{ code: "UNKNOWN_STORAGE_ERROR" }, "The image storage service rejected the upload. Your form data is preserved; try another image or contact the administrator."],
  ])("maps storage failures without exposing backend messages", (error, message) => {
    expect(classifyEvidenceUploadError({ ...error, message: "sensitive backend details" })).toBe(message);
  });
});
