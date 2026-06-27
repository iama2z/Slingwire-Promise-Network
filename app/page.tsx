import { getWichitaEvents } from "@/lib/events";

/**
 * Force request-time SSR so Vercel renders fresh event data on every request.
 */
export const dynamic = "force-dynamic";

/**
 * Strict server-rendered Wichita event feed with no client-side data fetching.
 */
export default async function HomePage() {
  const events = await getWichitaEvents(200);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 border-b border-zinc-200 pb-6">
        {/* Placeholder logo slot requested in spec. */}
        <div className="mb-3 inline-block rounded border border-zinc-300 px-3 py-1 text-xs tracking-[0.2em] uppercase">
          Slingwire Logo
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Slingwire Promise Network</h1>
        <p className="mt-2 text-sm text-zinc-600">
          A zero-tracking, open feed of verified Wichita local events for citizens,
          journalists, and the broader open web.
        </p>
      </header>

      <section>
        <h2 className="sr-only">Chronological Wichita Events Feed</h2>

        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">No Wichita events available yet.</p>
        ) : (
          <ul className="space-y-4">
            {events.map((event) => (
              <li key={event.id} className="border-b border-zinc-200 pb-4">
                <p className="mb-2 text-base leading-relaxed">{event.text}</p>
                <p className="text-xs text-zinc-500">
                  {event.authorHandle} · {new Date(event.occurredAtIso).toUTCString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
