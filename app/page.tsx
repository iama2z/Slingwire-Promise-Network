import { getWichitaEvents } from "@/lib/events";

/**
 * Force request-time SSR so Vercel renders fresh event data on every request.
 */
export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ submitted?: string; error?: string }>;
};

/**
 * Strict server-rendered Wichita event feed with no client-side data fetching.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
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

      <section className="mb-8 rounded border border-zinc-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Submit an Event</h2>
        <form action="/api/events" method="post" className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-600">Author Handle</span>
            <input
              name="authorHandle"
              required
              maxLength={80}
              placeholder="@you.promise.us"
              className="w-full rounded border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-600">Event Description</span>
            <textarea
              name="text"
              required
              minLength={5}
              maxLength={500}
              placeholder="Describe the local Wichita event..."
              className="min-h-24 w-full rounded border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-600">Event Time (optional)</span>
            <input
              type="datetime-local"
              name="occurredAt"
              className="w-full rounded border border-zinc-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="rounded border border-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-900 hover:text-white"
          >
            Publish Event
          </button>
        </form>

        {params.submitted === "1" ? (
          <p className="mt-3 text-sm text-emerald-700">Event published to the feed.</p>
        ) : null}

        {params.error ? <p className="mt-3 text-sm text-red-700">{params.error}</p> : null}
      </section>

      <section>
        <h2 className="sr-only">Chronological Wichita Events Feed</h2>

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
      </section>
    </main>
  );
}
