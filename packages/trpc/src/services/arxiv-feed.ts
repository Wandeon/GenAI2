import {
  RawFeedItem,
  NormalizedEvent,
  extractTopics
} from "@genai/shared";

const ARXIV_API = "http://export.arxiv.org/api/query";

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  published: string;
  authors: { name: string }[];
  links: { href: string; type?: string }[];
}

function parseArxivXML(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = [];
  const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  for (const entry of entryMatches) {
    const id = entry.match(/<id>(.*?)<\/id>/)?.[1] || "";
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() || "";
    const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim() || "";
    const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || "";

    const authorMatches = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g) || [];
    const authors = authorMatches.map((a) => ({
      name: a.match(/<name>(.*?)<\/name>/)?.[1] || "",
    }));

    const linkMatch = entry.match(/<link[^>]*href="([^"]*)"[^>]*type="text\/html"/);
    const pdfLink = entry.match(/<link[^>]*href="([^"]*)"[^>]*title="pdf"/);

    const htmlHref = linkMatch?.[1] ?? id;
    const pdfHref = pdfLink?.[1];

    entries.push({
      id,
      title,
      summary,
      published,
      authors,
      links: [
        { href: htmlHref, type: "text/html" },
        ...(pdfHref ? [{ href: pdfHref, type: "application/pdf" }] : []),
      ],
    });
  }

  return entries;
}

export async function fetchArxivPapers(): Promise<NormalizedEvent[]> {
  try {
    // Search for recent AI/ML papers
    const categories = "cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL";
    const url = `${ARXIV_API}?search_query=${categories}&sortBy=submittedDate&sortOrder=descending&max_results=20`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const xml = await res.text();
    const entries = parseArxivXML(xml);

    const events: NormalizedEvent[] = entries.map((entry) => {
      const arxivId = entry.id.split("/abs/")[1] || entry.id;
      const publishedDate = new Date(entry.published);

      const rawItem: RawFeedItem = {
        sourceType: "ARXIV",
        externalId: arxivId,
        url: entry.links[0]?.href || entry.id,
        title: entry.title,
        author: entry.authors[0]?.name,
        publishedAt: publishedDate,
      };

      return {
        id: `arxiv-${arxivId}`,
        sourceType: "ARXIV" as const,
        externalId: arxivId,
        url: rawItem.url,
        title: entry.title,
        occurredAt: publishedDate,
        impactLevel: "MEDIUM" as const,
        sourceCount: 1,
        topics: extractTopics(rawItem),
      };
    });

    return events;
  } catch (error) {
    console.error("arXiv feed error:", error);
    return [];
  }
}
