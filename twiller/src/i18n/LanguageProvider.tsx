"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import {
  DEFAULT_LANGUAGE,
  getLanguageByCode,
  getLanguageByKey,
  LANGUAGE_LOADERS,
  LANGUAGE_OPTIONS,
} from "./languages";

type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];

type LanguageContextValue = {
  language: LanguageOption;
  setLanguage: (languageKey: string) => Promise<void>;
  availableLanguages: LanguageOption[];
  isReady: boolean;
};

const STORAGE_KEY = "twiller-language";

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

const loadResources = async (code: string) => {
  if (i18n.hasResourceBundle(code, "common")) {
    return;
  }
  const loader = LANGUAGE_LOADERS[code];
  if (!loader) return;
  const resources = await loader();
  const bundle = resources?.default || resources;
  i18n.addResourceBundle(code, "common", bundle, true, true);
};

const readStoredLanguage = () => {
  if (typeof window === "undefined") return null;
  const storedKey = localStorage.getItem(STORAGE_KEY);
  if (storedKey) {
    const fromKey = getLanguageByKey(storedKey);
    if (fromKey) return fromKey;
  }

  const storedUser = localStorage.getItem("twitter-user");
  if (!storedUser) return null;
  try {
    const parsed = JSON.parse(storedUser);
    return getLanguageByKey(parsed?.preferredLanguage);
  } catch {
    return null;
  }
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageOption>(DEFAULT_LANGUAGE);
  const [isReady, setIsReady] = useState(false);

  const applyLanguage = useCallback(async (languageKey: string) => {
    const next =
      getLanguageByKey(languageKey) ||
      getLanguageByCode(languageKey) ||
      DEFAULT_LANGUAGE;

    await loadResources(next.code);
    await i18n.changeLanguage(next.code);
    setLanguageState(next);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next.key);
      document.documentElement.lang = next.code;
    }
  }, []);

  useEffect(() => {
    const stored = readStoredLanguage();
    const initial = stored || DEFAULT_LANGUAGE;
    applyLanguage(initial.key).finally(() => setIsReady(true));
  }, [applyLanguage]);

  const value = useMemo(
    () => ({
      language,
      setLanguage: applyLanguage,
      availableLanguages: LANGUAGE_OPTIONS,
      isReady,
    }),
    [applyLanguage, isReady, language],
  );

  return (
    <LanguageContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
