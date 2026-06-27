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
    return { iso: date.toISOString(), unix: date.getTime() };
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
 * Query Firestore for Wichita events in descending chronological order.
 */
export async function getWichitaEvents(limit = 100): Promise<EventItem[]> {
  const db = getFirebaseAdminDb();

  const snapshot = await db
    .collection("events")
    .where("city", "==", "Wichita")
    .orderBy("occurredAtUnix", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const occurred = normalizeDateValue(data.occurredAt ?? data.createdAt);
    const created = normalizeDateValue(data.createdAt ?? data.occurredAt);

    return {
      id: doc.id,
      text: String(data.text ?? ""),
      authorHandle: String(data.authorHandle ?? "unknown"),
      city: String(data.city ?? "Wichita"),
      source: String(data.source ?? "bluesky"),
      createdAtIso: created.iso,
      occurredAtIso: occurred.iso,
      occurredAtUnix: occurred.unix,
    };
  });
}
