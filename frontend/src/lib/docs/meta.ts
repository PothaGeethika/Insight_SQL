import { DOCS_SEARCH_INDEX } from "@/lib/docs/search-index";

export interface DocMeta {
  title: string;
  description: string;
}

const DOC_META_BY_SLUG: Record<string, DocMeta> = Object.fromEntries(
  DOCS_SEARCH_INDEX.map((entry) => [
    entry.slug,
    {
      title: entry.title,
      description: entry.description,
    },
  ])
);

export function getDocMeta(slug: string): DocMeta | undefined {
  return DOC_META_BY_SLUG[slug];
}
