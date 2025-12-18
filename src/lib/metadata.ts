import { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { getConfig } from "@/lib/config";

const DEFAULT_METADATA_BASE = process.env.NEXTAUTH_URL || "http://localhost:3000";

interface BuildMetadataOptions {
  title: string;
  description: string;
  /**
   * Path for the current route. Can include a leading slash and optional query string.
   * Examples: "/", "/prompts/123", "/tags/chatgpt?page=2"
   */
  path?: string;
  /**
   * Optional OpenGraph image. Provide a string URL or an object with dimensions.
   */
  image?: string | { url: string; width?: number; height?: number };
}

function normalizePath(path?: string) {
  if (!path || path === "/") {
    return { pathname: "/", search: "" };
  }

  const [rawPathname, rawSearch] = path.split("?");
  const pathname = rawPathname.startsWith("/") ? rawPathname : `/${rawPathname}`;
  const search = rawSearch ? `?${rawSearch}` : "";

  return { pathname, search };
}

export async function buildLocalizedMetadata({
  title,
  description,
  path,
  image,
}: BuildMetadataOptions): Promise<Metadata> {
  const locale = await getLocale();
  const config = await getConfig();
  const { pathname, search } = normalizePath(path);
  const metadataBase = new URL(DEFAULT_METADATA_BASE);

  const languages: Record<string, string> = {};

  for (const lang of config.i18n.locales) {
    const localePrefix = lang === config.i18n.defaultLocale ? "" : `/${lang}`;
    const localizedPath = `${localePrefix}${pathname === "/" ? "" : pathname}` || "/";
    const url = new URL(localizedPath || "/", metadataBase);
    if (search) {
      url.search = search;
    }
    languages[lang] = url.toString();
  }

  const canonicalPrefix = locale === config.i18n.defaultLocale ? "" : `/${locale}`;
  const canonicalPath = `${canonicalPrefix}${pathname === "/" ? "" : pathname}` || "/";
  const canonicalUrl = new URL(canonicalPath || "/", metadataBase);
  if (search) {
    canonicalUrl.search = search;
  }

  const ogImages = image
    ? typeof image === "string"
      ? [{ url: image }]
      : [{ url: image.url, width: image.width, height: image.height }]
    : [{ url: "/og.png", width: 1200, height: 630 }];

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl.toString(),
      languages: {
        "x-default": new URL(pathname === "/" ? "/" : pathname, metadataBase).toString(),
        ...languages,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl.toString(),
      siteName: config.branding.name,
      locale,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages.map((img) => img.url),
    },
  } satisfies Metadata;
}
