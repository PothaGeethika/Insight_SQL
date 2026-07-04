import type { Metadata } from "next";
import { DocsShell } from "@/components/docs/DocsShell";

export const metadata: Metadata = {
  title: "Documentation | InsightSQL",
  description: "Learn how to connect databases, ask questions in natural language, and turn results into charts with InsightSQL.",
  openGraph: {
    title: "InsightSQL Documentation",
    description: "Premium docs for natural language analytics across every database.",
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
