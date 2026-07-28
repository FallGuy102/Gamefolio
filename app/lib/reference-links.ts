import type { ReviewSection } from "./types";

export const REFERENCE_LINK_KIND = "reference-link";

export type ReferenceLink = {
  title: string;
  url: string;
};

export function parseReferenceLink(section: ReviewSection): ReferenceLink {
  try {
    const value = JSON.parse(section.content) as Partial<ReferenceLink>;
    return {
      title: typeof value.title === "string" ? value.title : "",
      url: typeof value.url === "string" ? value.url : "",
    };
  } catch {
    return { title: "", url: section.content };
  }
}

export function serializeReferenceLink(link: ReferenceLink) {
  return JSON.stringify({
    title: link.title,
    url: link.url,
  });
}

export function safeReferenceUrl(value: string) {
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const url = new URL(
      /^[a-z][a-z\d+\-.]*:/i.test(candidate) ? candidate : `https://${candidate}`,
    );
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
