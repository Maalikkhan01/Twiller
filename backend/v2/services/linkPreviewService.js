import axios from "axios";

const pickMetaTag = (html, name) => {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match ? match[1].trim() : "";
};

const pickTitle = (html) => {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : "";
};

const clampText = (value = "", max = 240) => String(value).slice(0, max);

export const fetchLinkPreview = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 4000,
      responseType: "text",
      maxContentLength: 1024 * 512,
      headers: {
        "User-Agent": "TwillerBot/2.0",
      },
    });

    const html = String(response.data || "");
    const title = clampText(pickMetaTag(html, "og:title") || pickTitle(html), 200);
    const description = clampText(
      pickMetaTag(html, "og:description") || pickMetaTag(html, "description"),
      300,
    );
    const image = clampText(pickMetaTag(html, "og:image"), 400);
    const siteName = clampText(pickMetaTag(html, "og:site_name"), 120);

    return {
      url,
      title,
      description,
      image,
      siteName,
    };
  } catch {
    return {
      url,
      title: "",
      description: "",
      image: "",
      siteName: "",
    };
  }
};

export const fetchLinkPreviews = async (links = []) => {
  const limited = links.slice(0, 3);
  const previews = await Promise.all(limited.map((url) => fetchLinkPreview(url)));
  return previews;
};
