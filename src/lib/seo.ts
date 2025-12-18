import { defaultLocale } from "@/lib/i18n/config";

function normalizeBaseUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function buildBaseUrl(headersList: Headers): string {
  const envUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL);
  if (envUrl) return envUrl;

  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "https";

  return `${protocol}://${host}`;
}

export function buildLocalizedUrl(path: string, locale: string, headersList: Headers): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const baseUrl = buildBaseUrl(headersList);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const localePrefix = locale && locale !== defaultLocale ? `/${locale}` : "";

  return `${baseUrl}${localePrefix}${normalizedPath}`;
}
