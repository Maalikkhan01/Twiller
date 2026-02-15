import crypto from "crypto";

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHABET = `${LOWERCASE}${UPPERCASE}`;

const clampLength = (length) => {
  if (!Number.isFinite(length)) return 12;
  if (length < 10) return 10;
  if (length > 12) return 12;
  return Math.trunc(length);
};

const randomIndex = (max) => crypto.randomInt(0, max);

const shuffle = (items) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
};

export const generatePassword = (length = 12) => {
  const targetLength = clampLength(length);
  const chars = [
    UPPERCASE[randomIndex(UPPERCASE.length)],
    LOWERCASE[randomIndex(LOWERCASE.length)],
  ];

  for (let i = chars.length; i < targetLength; i += 1) {
    chars.push(ALPHABET[randomIndex(ALPHABET.length)]);
  }

  shuffle(chars);
  return chars.join("");
};
