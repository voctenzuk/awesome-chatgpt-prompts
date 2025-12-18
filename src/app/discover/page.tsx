import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getConfig } from "@/lib/config";
import { buildLocalizedMetadata } from "@/lib/metadata";
import { DiscoveryPrompts } from "@/components/prompts/discovery-prompts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("discovery.metadata");
  const config = await getConfig();

  const title = t("title", { siteName: config.branding.name });
  const description = t("description", { siteName: config.branding.name });

  return buildLocalizedMetadata({
    title,
    description,
    path: "/discover",
  });
}

export default function DiscoverPage() {
  return (
    <div className="flex flex-col">
      <DiscoveryPrompts />
    </div>
  );
}
