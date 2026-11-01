import { useMemo } from "react";
import { AuthContext } from "./AuthContextValue";

export const AuthProvider = ({ children }) => {
  const value = useMemo(() => ({ user: null }), []);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
