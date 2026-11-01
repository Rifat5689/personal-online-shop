import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TbBuildingStore,
  TbChevronRight,
  TbDeviceMobile,
} from "react-icons/tb";
import { request } from "../../services/api";
import { useAuth } from "../../application/providers/AuthProvider";
import { errorMessage } from "../../services/api";

const storeKey = "ownshop:mobile-store";

export function MobileLaunch() {
  return <div className="state-card"><h1>Page not found</h1></div>;
}

export default function MobileAdminGateway() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [storeSlug, setStoreSlug] = useState(
    localStorage.getItem(storeKey) || "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!loading && ["ADMIN", "ECO"].includes(user?.role) && user?.store?.slug)
      navigate(`/${user.store.slug}/secure/admin/dashboard`, { replace: true });
  }, [loading, navigate, user]);
  const submit = async (event) => {
    event.preventDefault();
    const slug = storeSlug.trim().toLowerCase();
    setPending(true);
    setError("");
    try {
      await request("get", `/stores/slug/${encodeURIComponent(slug)}`);
      localStorage.setItem(storeKey, slug);
      navigate(slug === "demo-shop" ? "/demoadmin" : `/${slug}/secure/admin/login`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="mobile-gateway">
      <form onSubmit={submit}>
        <div className="mobile-app-mark">
          <TbDeviceMobile aria-hidden="true" />
        </div>
        <span>OwnShop Merchant</span>
        <h1>Manage your store</h1>
        <p>
          Enter your store address to continue to the secure merchant login.
        </p>
        <label>
          <span>
            <TbBuildingStore aria-hidden="true" /> Store address
          </span>
          <div>
            <input
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={storeSlug}
              onChange={(event) => setStoreSlug(event.target.value)}
              placeholder="your-store-name"
            />
            <small>.ownshop</small>
          </div>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary" disabled={pending}>
          {pending ? (
            <>
              <span className="spinner" />
              Checking store...
            </>
          ) : (
            <>
              Continue <TbChevronRight />
            </>
          )}
        </button>
      </form>
    </main>
  );
}
