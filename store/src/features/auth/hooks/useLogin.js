import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../application/providers/AuthProvider";
import { errorMessage } from "../../../services/api";
export function useLogin(roles, destination, demo = false) {
  const { login, logout } = useAuth();
  const storeSlug = "originsofbeauty";
  const isDemo = demo === true;
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({
    username: isDemo ? "demouser" : "",
    password: isDemo ? "123456" : "",
  }));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const user = await login({ ...form, storeSlug: storeSlug });
      if (!roles.includes(user.role)) {
        await logout();
        throw new Error(
          "This account does not have access to this application.",
        );
      }
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return { form, setForm, error, pending, submit, isDemo };
}
