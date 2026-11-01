import React from "react";
import { useNavigate, useLocation, useOutletContext } from "react-router-dom";
import { useStore } from "../../../application/providers/StoreProvider";
import { useCustomerAuth } from "../../../features/auth/hooks/useCustomerAuth";
import { CustomerAuthCard } from "../../../features/auth/components/CustomerAuthCard";

export default function CustomerAuthPage({ defaultMode = "signin" }) {
  const { store, storeSlug } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};

  const handleSuccess = (customerData) => {
    if (outletCtx.setCustomer) {
      outletCtx.setCustomer(customerData);
    }
    const destination = location.state?.from || `/account`;
    navigate(destination, { replace: true });
  };

  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate(`/`);
    }
  };

  const auth = useCustomerAuth({
    storeSlug,
    storeId: store?._id,
    defaultMode,
    onSuccess: handleSuccess,
  });

  return (
    <div className="ob-auth-page-wrapper">
      <CustomerAuthCard
        auth={auth}
        store={store}
        storeSlug={storeSlug}
        onBack={handleBack}
      />
    </div>
  );
}

