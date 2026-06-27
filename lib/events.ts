import { promises as fs } from "node:fs";
import path from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebaseAdmin";

export type EventItem = {
  id: string;
  text: string;
  authorHandle: string;
  city: string;
  source: string;
  createdAtIso: string;
  occurredAtIso: string;
  occurredAtUnix: number;
};

type CreateEventInput = {
  text: string;
  authorHandle: string;
  occurredAtIso?: string;
  city?: string;
};

const DEMO_STORAGE_DIR = "/tmp/slingwire-promise-network";
const DEMO_STORAGE_PATH = path.join(DEMO_STORAGE_DIR, "demo-events.json");
const DEFAULT_CITY = "Wichita";

/**
 * Normalize Firestore timestamp/date-like values into ISO strings and unix time.
 */
function normalizeDateValue(value: unknown): { iso: string; unix: number } {
  if (value instanceof Timestamp) {
    const date = value.toDate();
    return { iso: date.toISOString(), unix: date.getTime() };
  }

  if (value instanceof Date) {
    return { iso: value.toISOString(), unix: value.getTime() };
  }

  if (typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return { iso: date.toISOString(), unix: date.getTime() };
    }
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return { iso: date.toISOString(), unix: date.getTime() };
    }
  }

  const now = new Date();
  return { iso: now.toISOString(), unix: now.getTime() };
}

/**
 * Return whether all required Firebase Admin credentials are present.
 */
function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

/**
 * Generate a small seeded event list so the feed remains demoable without external setup.
 */
function getSeedDemoEvents(): EventItem[] {
  const now = Date.now();

  return [
    {
      id: "seed-1",
      text: "Riverside cleanup meetup this Saturday at 9:00 AM near Sim Park. Bring gloves and water.",
      authorHandle: "@community.promise.us",
      city: DEFAULT_CITY,
      source: "demo-seed",
      createdAtIso: new Date(now - 60 * 60 * 1000).toISOString(),
      occurredAtIso: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      occurredAtUnix: now - 2 * 60 * 60 * 1000,
    },
    {
      id: "seed-2",
      text: "Open mic night at Old Town starts at 7:30 PM. Family-friendly and free to attend.",
      authorHandle: "@events.promise.us",
      city: DEFAULT_CITY,
      source: "demo-seed",
      createdAtIso: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      occurredAtIso: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      occurredAtUnix: now - 4 * 60 * 60 * 1000,
    },
    {
      id: "seed-3",
      text: "Farmers market pop-up on Douglas Ave tomorrow morning from 8:00 AM to noon.",
      authorHandle: "@localnews.promise.us",
      city: DEFAULT_CITY,
      source: "demo-seed",
      createdAtIso: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      occurredAtIso: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      occurredAtUnix: now - 6 * 60 * 60 * 1000,
    },
  ];
}

/**
 * Normalize generic records into EventItem while preserving descending chronology.
 */
function normalizeEventRecord(record: Partial<EventItem> & { id: string }): EventItem {
  const occurred = normalizeDateValue(record.occurredAtIso ?? record.occurredAtUnix ?? record.createdAtIso);
  const created = normalizeDateValue(record.createdAtIso ?? record.occurredAtIso ?? record.occurredAtUnix);

  return {
    id: String(record.id),
    text: String(record.text ?? ""),
    authorHandle: String(record.authorHandle ?? "unknown"),
    city: String(record.city ?? DEFAULT_CITY),
    source: String(record.source ?? "unknown"),
    createdAtIso: created.iso,
    occurredAtIso: occurred.iso,
    occurredAtUnix: occurred.unix,
  };
}

/**
 * Read locally persisted demo events from /tmp when Firestore is unavailable.
 */
async function readDemoEvents(): Promise<EventItem[]> {
  try {
    const raw = await fs.readFile(DEMO_STORAGE_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => normalizeEventRecord({ ...(item || {}), id: String(item?.id ?? `demo-${index}`) }))
      .sort((a, b) => b.occurredAtUnix - a.occurredAtUnix);
  } catch {
    return [];
  }
}

/**
 * Persist demo events in /tmp for local demo environments.
 */
async function writeDemoEvents(events: EventItem[]): Promise<void> {
  await fs.mkdir(DEMO_STORAGE_DIR, { recursive: true });
  await fs.writeFile(DEMO_STORAGE_PATH, JSON.stringify(events, null, 2), "utf8");
}

/**
 * Query Firestore for Wichita events in descending chronological order,
 * with local/demo fallback when no live data is available.
 */
export async function getWichitaEvents(limit = 100): Promise<EventItem[]> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirebaseAdminDb();
      const snapshot = await db
        .collection("events")
        .where("city", "==", DEFAULT_CITY)
        .orderBy("occurredAtUnix", "desc")
        .limit(limit)
        .get();

      const firestoreEvents = snapshot.docs.map((doc) => {
        const data = doc.data();
        const occurred = normalizeDateValue(data.occurredAt ?? data.createdAt ?? data.occurredAtUnix);
        const created = normalizeDateValue(data.createdAt ?? data.occurredAt ?? data.occurredAtUnix);

        return {
          id: doc.id,
          text: String(data.text ?? ""),
          authorHandle: String(data.authorHandle ?? "unknown"),
          city: String(data.city ?? DEFAULT_CITY),
          source: String(data.source ?? "bluesky"),
          createdAtIso: created.iso,
          occurredAtIso: occurred.iso,
          occurredAtUnix: occurred.unix,
        };
      });

      if (firestoreEvents.length > 0) {
        return firestoreEvents;
      }
    } catch {
      // Fall through to demo storage when Firestore access fails in demo contexts.
    }
  }

  const demoEvents = await readDemoEvents();
  if (demoEvents.length > 0) {
    return demoEvents.slice(0, limit);
  }

  return getSeedDemoEvents().slice(0, limit);
}

/**
 * Create an event in Firestore when available; otherwise write to local demo storage.
 */
export async function createEvent(input: CreateEventInput): Promise<EventItem> {
  const occurred = normalizeDateValue(input.occurredAtIso);
  const created = normalizeDateValue(undefined);

  const normalizedEvent: EventItem = {
    id: `demo-${Date.now()}`,
    text: input.text.trim(),
    authorHandle: input.authorHandle.trim(),
    city: input.city?.trim() || DEFAULT_CITY,
    source: "manual-submission",
    createdAtIso: created.iso,
    occurredAtIso: occurred.iso,
    occurredAtUnix: occurred.unix,
  };

  if (isFirebaseConfigured()) {
    try {
      const db = getFirebaseAdminDb();
      const docRef = await db.collection("events").add({
        text: normalizedEvent.text,
        authorHandle: normalizedEvent.authorHandle,
        city: normalizedEvent.city,
        source: normalizedEvent.source,
        occurredAt: normalizedEvent.occurredAtIso,
        occurredAtUnix: normalizedEvent.occurredAtUnix,
        createdAt: created.iso,
      });

      return {
        ...normalizedEvent,
        id: docRef.id,
      };
    } catch {
      // Fall through to local demo storage when Firestore write fails.
    }
  }

  const existing = await readDemoEvents();
  const merged = [normalizedEvent, ...existing]
    .sort((a, b) => b.occurredAtUnix - a.occurredAtUnix)
    .slice(0, 200);
  await writeDemoEvents(merged);

  return normalizedEvent;
}
