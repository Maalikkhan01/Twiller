const HASHTAG_REGEX = /(^|\s)#([a-zA-Z0-9_]{1,64})/g;
const MENTION_REGEX = /(^|\s)@([a-zA-Z0-9_.]{1,32})/g;
const LINK_REGEX = /(https?:\/\/[^\s]+)/gi;

export const extractHashtags = (content = "") => {
  const tags = new Set();
  let match;
  while ((match = HASHTAG_REGEX.exec(content)) !== null) {
    tags.add(String(match[2] || "").toLowerCase());
  }
  return Array.from(tags);
};

export const extractMentions = (content = "") => {
  const mentions = new Set();
  let match;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    mentions.add(String(match[2] || "").toLowerCase());
  }
  return Array.from(mentions);
};

export const extractLinks = (content = "") => {
  const links = new Set();
  const matches = content.match(LINK_REGEX) || [];
  for (const item of matches) {
    const cleaned = String(item).trim().replace(/[),.!?]+$/, "");
    try {
      const parsed = new URL(cleaned);
      links.add(parsed.toString());
    } catch {
      // Ignore malformed URLs.
    }
  }
  return Array.from(links);
};
