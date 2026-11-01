import multer from "multer";
import ApiError from "../utils/ApiError.js";

export const productImages = multer({
  storage: multer.memoryStorage(),
  limits: { files: 6, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, done) =>
    done(
      ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
        ? null
        : new ApiError(400, "Upload JPEG, PNG or WebP images"),
      true,
    ),
}).array("images", 6);

export const categoryImage = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, done) => done(
    ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
      ? null : new ApiError(400, "Upload JPEG, PNG or WebP images"), true,
  ),
}).single("image");
