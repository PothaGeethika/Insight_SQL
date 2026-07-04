import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocArticleContent } from "@/components/docs/DocArticleContent";
import { getDocMeta } from "@/lib/docs/meta";
import { getAllSlugs, getDocBySlug } from "@/lib/docs/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  const meta = getDocMeta(slug);
  if (!doc || !meta) return { title: "Not Found | InsightSQL Docs" };
  return {
    title: `${meta.title} | InsightSQL Docs`,
    description: meta.description,
  };
}

export default async function DocSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  return <DocArticleContent slug={slug} />;
}
