import type { MetadataRoute } from "next";
import { METADATA_BASE } from "@/app/layout";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = METADATA_BASE;
  const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/prompts", "/categories", "/tags", "/discover", "/promptmasters"],
      disallow: ["/api", "/admin", "/settings", "/feed", "/auth", "/prompts/new"],
    },
    sitemap: sitemapUrl,
  };
}
