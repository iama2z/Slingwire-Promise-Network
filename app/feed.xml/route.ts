import { getWichitaEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * Escape unsafe XML entities so user-generated post text is RSS-safe.
 */
function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Serve an RSS 2.0 document built dynamically from Wichita events in Firestore/demo storage.
 */
export async function GET(request: Request) {
  const events = await getWichitaEvents(100);
  const buildDate = new Date().toUTCString();
  const origin = new URL(request.url).origin;

  const items = events
    .map((event) => {
      const title = escapeXml(`${event.authorHandle}: ${event.text.slice(0, 80)}`);
      const description = escapeXml(event.text);
      const pubDate = new Date(event.occurredAtIso).toUTCString();
      const guid = `slingwire:${event.id}`;

      return `
        <item>
          <title>${title}</title>
          <description>${description}</description>
          <author>${escapeXml(event.authorHandle)}</author>
          <guid isPermaLink="false">${escapeXml(guid)}</guid>
          <link>${origin}/</link>
          <pubDate>${pubDate}</pubDate>
        </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Slingwire Promise Network - Wichita Events</title>
    <link>${origin}/</link>
    <description>Open, zero-tracking local events feed for Wichita.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
}
