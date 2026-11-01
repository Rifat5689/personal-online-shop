import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { request } from "../../../services/api";

export function useProductImages(tenantId, platform) {
  const [progress, setProgress] = useState(0);
  const mutation = useMutation({
    onMutate: () => setProgress(0),
    mutationFn: (files) => {
      if (!files.length || files.length > 6) throw new Error("Select between 1 and 6 photos at a time.");
      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error("Choose JPEG, PNG or WebP photos.");
        if (file.size > 5 * 1024 * 1024)
          throw new Error(`"${file.name}" is larger than 5 MB.`);
      }
      if (platform && !tenantId) throw new Error("Select a store before uploading photos.");
      const body = new FormData();
      for (const file of files) body.append("images", file);
      const suffix = platform
        ? `?tenantId=${encodeURIComponent(tenantId)}`
        : "";
      return request("post", `/products/images${suffix}`, body, {
        headers: { "Content-Type": undefined },
        timeout: 150000,
        onUploadProgress: ({ loaded, total }) => {
          if (total) setProgress(Math.min(100, Math.round(loaded * 100 / total)));
        },
      });
    },
  });
  return { ...mutation, progress };
}
