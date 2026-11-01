import { useState, useCallback } from "react";
import { authService } from "../services/authService";
import { errorMessage } from "../../../services/api";

const customerKey = (storeId) => `ownshop:customer:${storeId}`;
const browserKey = "ownshop:browser-id";

export function useCustomerAuth({ storeSlug, storeId, defaultMode = "signin", onSuccess } = {}) {
  const [mode, setMode] = useState(defaultMode); // "signin" | "signup"
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    setError("");
  }, []);

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }, []);

  const toggleShowPassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const submit = useCallback(
    async (event) => {
      if (event) event.preventDefault();
      const username = form.username.trim();
      const password = form.password;

      if (!username) {
        setError("Please enter your username.");
        return;
      }
      if (username.length < 2) {
        setError("Username must be at least 2 characters.");
        return;
      }
      if (!password) {
        setError("Please enter your password.");
        return;
      }
      if (mode === "signup" && password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      setPending(true);
      setError("");

      let browserId = "";
      try {
        browserId = localStorage.getItem(browserKey) || "";
        if (!browserId && typeof crypto !== "undefined" && crypto.randomUUID) {
          browserId = crypto.randomUUID();
          localStorage.setItem(browserKey, browserId);
        }
      } catch {
        // localStorage not available
      }

      try {
        const payload = { username, password, browserId };
        const result =
          mode === "signup"
            ? await authService.customerRegister(storeSlug, payload)
            : await authService.customerLogin(storeSlug, payload);

        const customerData = {
          _id: result._id,
          username: result.username,
          token: result.token,
          isMerchant: result.isMerchant,
          signedInAt: new Date().toISOString(),
        };

        if (storeId) {
          try {
            localStorage.setItem(customerKey(storeId), JSON.stringify(customerData));
          } catch {
            // ignore
          }
        }

        if (onSuccess) {
          onSuccess(customerData);
        }
        return customerData;
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setPending(false);
      }
    },
    [form, mode, storeSlug, storeId, onSuccess],
  );

  return {
    mode,
    switchMode,
    form,
    setField,
    showPassword,
    toggleShowPassword,
    pending,
    error,
    submit,
  };
}

