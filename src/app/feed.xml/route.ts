import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { getPromptUrl } from "@/lib/urls";

const MAX_FEED_ITEMS = 50;

function getBaseUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  const [config, prompts] = await Promise.all([
    getConfig(),
    db.prompt.findMany({
      where: {
        isPrivate: false,
        isUnlisted: false,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: MAX_FEED_ITEMS,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            username: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const baseUrl = getBaseUrl();
  const feedUrl = new URL("/feed.xml", baseUrl).toString();
  const siteUrl = baseUrl.toString();
  const lastBuildDate = prompts[0]?.updatedAt ?? new Date();
  const language = config.i18n?.defaultLocale ?? "en";

  const items = prompts
    .map((prompt) => {
      const promptUrl = new URL(getPromptUrl(prompt.id, prompt.slug), baseUrl).toString();
      const title = escapeXml(prompt.title);
      const description = prompt.description
        ? escapeXml(prompt.description)
        : "";
      const authorName = prompt.author.name || prompt.author.username || "";
      const author = authorName ? `<author>${escapeXml(authorName)}</author>` : "";

      return [
        "<item>",
        `<title>${title}</title>`,
        `<link>${promptUrl}</link>`,
        `<guid>${promptUrl}</guid>`,
        description ? `<description>${description}</description>` : "",
        author,
        `<pubDate>${prompt.createdAt.toUTCString()}</pubDate>`,
        "</item>",
      ]
        .filter(Boolean)
        .join("");
    })
    .join("");

  const xml = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">",
    "<channel>",
    `<title>${escapeXml(config.branding.name)}</title>`,
    `<description>${escapeXml(config.branding.description)}</description>`,
    `<link>${siteUrl}</link>`,
    `<language>${escapeXml(language)}</language>`,
    `<lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>`,
    `<atom:link href=\"${feedUrl}\" rel=\"self\" type=\"application/rss+xml\" />`,
    items,
    "</channel>",
    "</rss>",
  ].join("");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
