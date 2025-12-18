import { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfinitePromptList } from "@/components/prompts/infinite-prompt-list";
import { PromptFilters } from "@/components/prompts/prompt-filters";
import { FilterProvider } from "@/components/prompts/filter-context";
import { HFDataStudioDropdown } from "@/components/prompts/hf-data-studio-dropdown";
import { McpServerPopup } from "@/components/mcp/mcp-server-popup";
import { db } from "@/lib/db";
import { isAISearchEnabled, semanticSearch } from "@/lib/ai/embeddings";
import { isAIGenerationEnabled } from "@/lib/ai/generation";
import { getConfig } from "@/lib/config";
import { buildLocalizedMetadata } from "@/lib/metadata";
import { buildBaseUrl, buildLocalizedUrl } from "@/lib/seo";
import { getPromptUrl } from "@/lib/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("prompts.metadata");
  const config = await getConfig();

  const title = t("title", { siteName: config.branding.name });
  const description = t("description", { siteName: config.branding.name });

  return buildLocalizedMetadata({
    title,
    description,
    path: "/prompts",
  });
}

interface PromptsPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    category?: string;
    tag?: string;
    sort?: string;
    page?: string;
    ai?: string;
  }>;
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const config = await getConfig();
  const t = await getTranslations("prompts");
  const tSearch = await getTranslations("search");
  const locale = await getLocale();
  const headersList = headers();
  const baseUrl = buildBaseUrl(headersList);
  const buildUrl = (path: string) => buildLocalizedUrl(path, locale, headersList);
  const params = await searchParams;
  
  const perPage = 12;
  const aiSearchAvailable = await isAISearchEnabled();
  const aiGenerationAvailable = await isAIGenerationEnabled();
  const useAISearch = aiSearchAvailable && params.ai === "1" && params.q;

  let prompts: any[] = [];
  let total = 0;

  if (useAISearch && params.q) {
    // Use AI semantic search
    try {
      const aiResults = await semanticSearch(params.q, perPage);
      prompts = aiResults.map((p) => ({
        ...p,
        contributorCount: 0,
      }));
      total = aiResults.length;
    } catch {
      // Fallback to regular search on error
    }
  }
  
  // Regular search if AI search not used or failed
  if (!useAISearch || prompts.length === 0) {
    // Build where clause based on filters
    const where: Record<string, unknown> = {
      isPrivate: false,
      isUnlisted: false, // Exclude unlisted prompts
      deletedAt: null, // Exclude soft-deleted prompts
    };
    
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: "insensitive" } },
        { content: { contains: params.q, mode: "insensitive" } },
        { description: { contains: params.q, mode: "insensitive" } },
      ];
    }
    
    if (params.type) {
      where.type = params.type;
    }
    
    if (params.category) {
      where.categoryId = params.category;
    }
    
    if (params.tag) {
      where.tags = {
        some: {
          tag: {
            slug: params.tag,
          },
        },
      };
    }
    
    // Build order by clause
    const isUpvoteSort = params.sort === "upvotes";
    let orderBy: any = { createdAt: "desc" };
    if (params.sort === "oldest") {
      orderBy = { createdAt: "asc" };
    } else if (isUpvoteSort) {
      // Sort by vote count descending
      orderBy = { votes: { _count: "desc" } };
    }

    // Fetch initial prompts (first page)
    const [promptsRaw, totalCount] = await Promise.all([
      db.prompt.findMany({
        where,
        orderBy,
        skip: 0,
        take: perPage,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          contributors: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: { votes: true, contributors: true },
          },
        },
      }),
      db.prompt.count({ where }),
    ]);

    // Transform to include voteCount and contributorCount
    prompts = promptsRaw.map((p) => ({
      ...p,
      voteCount: p._count.votes,
      contributorCount: p._count.contributors,
      contributors: p.contributors,
    }));
    total = totalCount;
  }

  // Fetch categories for filter (with parent info for nesting)
  const categories = await db.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  });

  // Fetch tags for filter
  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
  });

  const toAbsoluteAssetUrl = (path?: string | null) => {
    if (!path) return undefined;
    if (/^https?:\/\//i.test(path)) return path;
    return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  };

  const creativeWorks = prompts.map((promptItem) => ({
    "@type": "CreativeWork",
    name: promptItem.title,
    description: promptItem.description ?? undefined,
    url: buildUrl(getPromptUrl(promptItem.id, promptItem.slug)),
    author: {
      "@type": "Person",
      name: promptItem.author.name || promptItem.author.username,
      url: buildUrl(`/@${promptItem.author.username}`),
    },
    inLanguage: locale,
    datePublished: promptItem.createdAt ? new Date(promptItem.createdAt).toISOString() : undefined,
    dateModified: promptItem.updatedAt
      ? new Date(promptItem.updatedAt).toISOString()
      : promptItem.createdAt
        ? new Date(promptItem.createdAt).toISOString()
        : undefined,
  }));

  const breadcrumbList = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: config.branding.name,
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t("title"),
        item: buildUrl("/prompts"),
      },
    ],
  };

  const organization = {
    "@type": "Organization",
    name: config.branding.name,
    url: baseUrl,
    description: config.branding.description,
    logo: toAbsoluteAssetUrl(config.branding.logo || "/logo.svg"),
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [organization, breadcrumbList, ...creativeWorks],
  };

  return (
    <div className="container py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <span className="text-xs text-muted-foreground">{tSearch("found", { count: total })}</span>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {!config.homepage?.useCloneBranding && (
            <div className="flex items-center gap-2">
              <HFDataStudioDropdown aiGenerationEnabled={aiGenerationAvailable} />
              {config.features.mcp !== false && <McpServerPopup />}
            </div>
          )}
          <Button size="sm" className="h-8 text-xs w-full sm:w-auto" asChild>
            <Link href="/prompts/new">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("create")}
            </Link>
          </Button>
        </div>
      </div>

      <FilterProvider>
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
            <PromptFilters
              categories={categories}
              tags={tags}
              currentFilters={params}
              aiSearchEnabled={aiSearchAvailable}
            />
          </aside>
          <main className="flex-1 min-w-0">
            <InfinitePromptList
              initialPrompts={prompts}
              initialTotal={total}
              filters={{
                q: params.q,
                type: params.type,
                category: params.category,
                tag: params.tag,
                sort: params.sort,
              }}
            />
          </main>
        </div>
      </FilterProvider>
    </div>
  );
}
