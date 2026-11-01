import { randomUUID } from "node:crypto";
import { getImageContainer } from "../config/storage.js";
import ApiError from "../utils/ApiError.js";

export async function uploadProductImage(file, tenantId, folder = "products") {
  const bytes = file.buffer;
  const valid =
    (file.mimetype === "image/jpeg" &&
      bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
    (file.mimetype === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (file.mimetype === "image/webp" &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP");
  if (!valid)
    throw new ApiError(400, "The file contents do not match its image type");
  const container = getImageContainer();
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.mimetype];
  const safeFolder = ["products", "profile", "categories"].includes(folder)
    ? folder
    : "products";
  const key = `stores/${tenantId}/${safeFolder}/${randomUUID()}.${extension}`;
  const blob = container.getBlockBlobClient(key);
  try {
    await blob.uploadData(bytes, {
      blobHTTPHeaders: { blobContentType: file.mimetype, blobCacheControl: "public, max-age=31536000, immutable" },
      abortSignal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    console.error("Azure image upload failed", { name: error.name, code: error.code, statusCode: error.statusCode });
    throw new ApiError(503, "Image storage is unavailable. Please try again later.");
  }
  return {
    url: blob.url,
    public_id: key,
  };
}

export async function deleteProductImages(images, tenantId) {
  const prefix = `stores/${tenantId}/products/`;
  const keys = [...new Set((images || []).map((image) => image?.public_id))].filter(
    (key) => typeof key === "string" && key.startsWith(prefix),
  );
  if (!keys.length) return 0;
  const container = getImageContainer();
  try {
    for (let index = 0; index < keys.length; index += 10) {
      await Promise.all(keys.slice(index, index + 10).map((key) =>
        container.getBlockBlobClient(key).deleteIfExists({
          deleteSnapshots: "include", abortSignal: AbortSignal.timeout(20000),
        }),
      ));
    }
  } catch {
    throw new ApiError(503, "Product images could not be removed from storage. No products were deleted.");
  }
  return keys.length;
}

export async function deleteCategoryImage(image, tenantId) {
  if (!image?.public_id?.startsWith(`stores/${tenantId}/categories/`)) return;
  await getImageContainer().getBlockBlobClient(image.public_id).deleteIfExists({
    deleteSnapshots: "include", abortSignal: AbortSignal.timeout(20000),
  });
}
