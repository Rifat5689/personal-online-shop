import React, { createContext, useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../application/providers/AuthProvider";
import { request } from "../../services/api";
import translations from "./bn.json";
const dictionary = Object.fromEntries(
  Object.entries(translations).map(([key, value]) => [
    key.toLowerCase(),
    value,
  ]),
);
const LanguageContext = createContext("en");
export function translateText(text, language) {
  if (language !== "bn" || typeof text !== "string") return text;
  const key = text.trim();
  const translated =
    dictionary[key.toLowerCase()] ||
    dictionary[key.replace(/[.…]+$/, "...").toLowerCase()];
  if (translated)
    return (
      (text.match(/^\s*/)?.[0] || "") +
      translated +
      (text.match(/\s*$/)?.[0] || "")
    );
  const patterns = [
    [/^Last (\d+) days$/i, (n) => `গত ${n} দিন`],
    [/^Valid for (\d+) days$/i, (n) => `${n} দিনের জন্য বৈধ`],
    [/^(\d+) products?$/i, (n) => `${n}টি পণ্য`],
    [/^(\d+) orders?$/i, (n) => `${n}টি অর্ডার`],
    [/^Page (\d+) of (\d+)$/i, (a, b) => `${b}টির মধ্যে পৃষ্ঠা ${a}`],
    [/^View (.+) dashboard$/i, (name) => `${name} ড্যাশবোর্ড দেখুন`],
    [/^(\d+) products restored\.$/i, (n) => `${n}টি পণ্য পুনরুদ্ধার হয়েছে।`],
  ];
  for (const [pattern, format] of patterns) {
    const match = key.match(pattern);
    if (match) return format(...match.slice(1));
  }
  return text;
}
export function usePageTranslation() {
  const language = useContext(LanguageContext);
  return {
    language,
    t: (value) => translateText(value, language),
  };
}
export function AdminLanguageProvider({ children }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["adminPreferences", user?._id, user?.tenantId],
    queryFn: async () => ({pageLanguages:{}}),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 15000,
  });
  const relative =
    pathname.split(/\/secure\/admin\/?|\/details\/?/)[1] || "dashboard";
  const page = relative.includes("subscription/checkout")
    ? "checkout"
    : relative.split("/")[0] || "dashboard";
  const language = query.data?.pageLanguages?.[page] || "en";
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [language]);
  return (
    <LanguageContext.Provider value={language}>
      <div lang={language} className="admin-language-surface">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}
