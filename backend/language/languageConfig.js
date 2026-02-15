export const LANGUAGE_OPTIONS = [
  {
    key: "English",
    otpChannel: "sms",
  },
  {
    key: "Spanish",
    otpChannel: "sms",
  },
  {
    key: "Hindi",
    otpChannel: "sms",
  },
  {
    key: "Portuguese",
    otpChannel: "sms",
  },
  {
    key: "Chinese",
    otpChannel: "sms",
  },
  {
    key: "French",
    otpChannel: "email",
  },
];

export const getLanguageByKey = (key) => {
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return null;
  return (
    LANGUAGE_OPTIONS.find(
      (language) => language.key.toLowerCase() === normalized,
    ) || null
  );
};
