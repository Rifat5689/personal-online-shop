import { useEffect, useState } from "react";
import { useManagementPage } from "../../management/hooks/useManagementPage";
export function useCategoriesPage() {
  const hook = useManagementPage("adminCategories", "/categories");
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const url = photo ? URL.createObjectURL(photo) : "";
    setPreview(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [photo]);
  const edit = (category) => {
    setPhoto(null);
    setRemoveImage(false);
    setEditing(category);
    setName(category?.name || "");
  };
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData();
    data.append("name", name);
    if (photo) data.append("image", photo);
    if (removeImage) data.append("removeImage", "true");
    hook.mutation.mutate(
      {
        method: editing?._id ? "patch" : "post",
        id: editing?._id,
        data,
      },
      {
        onSuccess: () => {
          setPhoto(null);
          setRemoveImage(false);
          setEditing(null);
          setName("");
        },
      },
    );
  };
  return { ...hook, photo, setPhoto, removeImage, setRemoveImage, preview, editing, name, setName, edit, submit };
}
