export const LANGUAGE_OPTIONS = [
  {
    key: "English",
    code: "en",
    labelKey: "languages.english",
    otpChannel: "sms",
  },
  {
    key: "Spanish",
    code: "es",
    labelKey: "languages.spanish",
    otpChannel: "sms",
  },
  {
    key: "Hindi",
    code: "hi",
    labelKey: "languages.hindi",
    otpChannel: "sms",
  },
  {
    key: "Portuguese",
    code: "pt",
    labelKey: "languages.portuguese",
    otpChannel: "sms",
  },
  {
    key: "Chinese",
    code: "zh",
    labelKey: "languages.chinese",
    otpChannel: "sms",
  },
  {
    key: "French",
    code: "fr",
    labelKey: "languages.french",
    otpChannel: "email",
  },
];

export const DEFAULT_LANGUAGE = LANGUAGE_OPTIONS[0];

export const getLanguageByKey = (key: string | null | undefined) =>
  LANGUAGE_OPTIONS.find((lang) => lang.key === key) || null;

export const getLanguageByCode = (code: string | null | undefined) =>
  LANGUAGE_OPTIONS.find((lang) => lang.code === code) || null;

export const LANGUAGE_LOADERS: Record<string, () => Promise<any>> = {
  en: () => import("../locales/en/common.json"),
  es: () => import("../locales/es/common.json"),
  hi: () => import("../locales/hi/common.json"),
  pt: () => import("../locales/pt/common.json"),
  zh: () => import("../locales/zh/common.json"),
  fr: () => import("../locales/fr/common.json"),
};
