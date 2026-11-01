import { useSubscription } from "../../subscription/useSubscription";
import { useMerchantPanel } from "../../../application/providers/MerchantPanelProvider";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "../../../services/api";
export function useSettingsPage(platform) {
  const subscription = useSubscription({ enabled: !platform });
  const { ownerAccess } = useMerchantPanel();
  const themeAllowed = ownerAccess || subscription.data?.themeAllowed === true;
  const endpoint = "/stores/mine";
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [endpoint],
    queryFn: () => request("get", endpoint),
  });
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);
  const [imageError, setImageError] = useState("");
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);
  const mutation = useMutation({
    mutationFn: () =>
      request("patch", endpoint, {
        name: form.name,
        supportEmail: form.supportEmail,
        description: form.description,
        ...(!platform && themeAllowed ? { theme: form.theme || "pink" } : {}),
        shippingFee: Number(form.shippingFee || 0),
        shippingFees: {
          insideDhaka: Number(form.shippingFees?.insideDhaka || 0),
          outsideDhaka: Number(form.shippingFees?.outsideDhaka || 0),
        },
        useZoneShippingFees: true,
        showShippingFees: form.showShippingFees !== false,
        whatsappNumber: form.whatsappNumber,
        currency: form.currency,
        timezone: form.timezone,
      }),
    onSuccess: () => {
      setSaved(true);
      client.invalidateQueries({ queryKey: [endpoint] });
      client.invalidateQueries({ queryKey: ["store"] });
    },
  });
  const imageUpload = useMutation({
    mutationFn: (file) => {
      setImageError("");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("Choose a JPEG, PNG or WebP image.");
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Store image must be smaller than 5 MB.");
      const body = new FormData();
      body.append("images", file);
      return request("post", "/stores/mine/profile-image", body, {
        headers: { "Content-Type": undefined },
        timeout: 90000,
      });
    },
    onSuccess: (profileImage) => {
      setForm((current) => ({ ...current, profileImage }));
      client.invalidateQueries({ queryKey: [endpoint] });
      client.invalidateQueries({ queryKey: ["store"] });
    },
    onError: (error) => {
      if (!error?.response)
        setImageError(error?.message || "Image upload failed.");
    },
  });
  return {
    query,
    subscription,
    themeAllowed,
    form,
    setForm: (value) => {
      setSaved(false);
      setForm(value);
    },
    mutation,
    imageUpload,
    imageError,
    saved,
  };
}
