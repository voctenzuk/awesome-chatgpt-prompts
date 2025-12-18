import type { MetadataRoute } from "next";
import { metadata } from "@/app/layout";

function getBaseUrl(): URL {
  if (metadata.metadataBase) {
    return metadata.metadataBase as URL;
  }

  return new URL(process.env.NEXTAUTH_URL || "http://localhost:3000");
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();
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
