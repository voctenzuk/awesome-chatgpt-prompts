import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { getPromptUrl } from "@/lib/urls";

function getBaseUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getConfig();
  const locales = config.i18n?.locales ?? ["en"];
  const defaultLocale = config.i18n?.defaultLocale ?? locales[0] ?? "en";
  const baseUrl = getBaseUrl();

  const buildEntry = (path: string, lastModified?: Date): MetadataRoute.Sitemap[number] => {
    const normalizedPath = path === "/" ? "" : path;

    const languages = Object.fromEntries(
      locales.map((locale) => {
        const localePrefix = locale === defaultLocale ? "" : `/${locale}`;
        const localizedPath = `${localePrefix}${normalizedPath || "/"}`;
        return [locale, new URL(localizedPath, baseUrl).toString()];
      }),
    );

    const canonicalUrl = languages[defaultLocale] ?? new URL(normalizedPath || "/", baseUrl).toString();

    return {
      url: canonicalUrl,
      lastModified,
      alternates: {
        languages,
      },
    };
  };

  const categoriesEnabled = config.features?.categories !== false;
  const tagsEnabled = config.features?.tags !== false;

  const mainRoutes = [
    "/",
    "/prompts",
    ...(categoriesEnabled ? ["/categories"] : []),
    ...(tagsEnabled ? ["/tags"] : []),
    "/discover",
    "/promptmasters",
    "/brand",
    "/privacy",
    "/terms",
  ];

  const [prompts, categories, tags, users] = await Promise.all([
    db.prompt.findMany({
      where: {
        isPrivate: false,
        isUnlisted: false,
        deletedAt: null,
      },
      select: {
        id: true,
        slug: true,
        updatedAt: true,
      },
    }),
    categoriesEnabled
      ? db.category.findMany({
          select: {
            slug: true,
          },
        })
      : Promise.resolve([]),
    tagsEnabled
      ? db.tag.findMany({
          select: {
            slug: true,
          },
        })
      : Promise.resolve([]),
    db.user.findMany({
      where: {
        prompts: {
          some: {
            isPrivate: false,
            isUnlisted: false,
            deletedAt: null,
          },
        },
      },
      select: {
        username: true,
        updatedAt: true,
      },
    }),
  ]);

  const mainEntries = mainRoutes.map((route) => buildEntry(route));
  const promptEntries = prompts.map((prompt) => buildEntry(getPromptUrl(prompt.id, prompt.slug), prompt.updatedAt));
  const categoryEntries = categories.map((category) => buildEntry(`/categories/${category.slug}`));
  const tagEntries = tags.map((tag) => buildEntry(`/tags/${tag.slug}`));
  const userEntries = users.map((user) => buildEntry(`/@${user.username}`, user.updatedAt));

  return [...mainEntries, ...promptEntries, ...categoryEntries, ...tagEntries, ...userEntries];
}
