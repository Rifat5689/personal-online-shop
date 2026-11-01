import React, { createContext, useContext } from "react";
import { useParams } from "react-router-dom";
const MerchantPanelContext = createContext(null);
export function MerchantPanelProvider({ value, children }) {
  return (
    <MerchantPanelContext.Provider value={value}>
      {children}
    </MerchantPanelContext.Provider>
  );
}
export function useMerchantPanel() {
  const context = useContext(MerchantPanelContext);
  const storeSlug = "originsofbeauty";
  return (
    context || {
      storeSlug,
      base: `/secure/admin`,
      ownerAccess: false,
    }
  );
}
