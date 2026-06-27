"use strict";

/**
 * Standalone Bluesky Jetstream listener:
 * - Streams events from Jetstream over WebSocket.
 * - Filters posts containing #WichitaEvents.
 * - Stores normalized events in Firestore `events` collection.
 *
 * Run with:
 *   node bluesky-listener/ingest.js
 */

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const WebSocket = require("ws");

const JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe";
const REQUIRED_HASHTAG = /(^|\s)#WichitaEvents(\b|\s|$)/i;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

/**
 * Initialize Firebase Admin once per process.
 */
function getDb() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Missing Firebase Admin credentials: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
      );
    }

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return getFirestore();
}

const db = getDb();
let reconnectDelay = RECONNECT_BASE_MS;

/**
 * Best-effort extraction of post payloads from Jetstream messages.
 */
function extractPostRecord(message) {
  // Common format from Jetstream commit payloads.
  const record = message?.commit?.record || message?.record;
  const text = record?.text;

  if (typeof text !== "string" || text.length === 0) {
    return null;
  }

  // Prefer resolved handle if present, otherwise fall back to DID.
  const handle =
    message?.identity?.handle ||
    message?.author?.handle ||
    message?.did ||
    "unknown";

  const rawTimestamp =
    record?.createdAt ||
    message?.time_us ||
    message?.timestamp ||
    Date.now();

  const occurredDate = new Date(rawTimestamp);
  const occurredAtIso = Number.isNaN(occurredDate.getTime())
    ? new Date().toISOString()
    : occurredDate.toISOString();

  return {
    text,
    authorHandle: String(handle),
    occurredAtIso,
  };
}

/**
 * Persist an event document keyed by repo/rkey when available to prevent duplicates.
 */
async function saveEvent(message, post) {
  const collection = db.collection("events");
  const docId =
    message?.commit?.rkey && message?.did
      ? `${message.did}_${message.commit.rkey}`.replace(/[^a-zA-Z0-9_-]/g, "_")
      : undefined;

  const payload = {
    text: post.text,
    authorHandle: post.authorHandle,
    city: "Wichita",
    source: "bluesky",
    preferredAuthorDomain: post.authorHandle.endsWith(".promise.us"),
    occurredAt: post.occurredAtIso,
    occurredAtUnix: new Date(post.occurredAtIso).getTime(),
    createdAt: FieldValue.serverTimestamp(),
    hashtag: "#WichitaEvents",
  };

  if (docId) {
    await collection.doc(docId).set(payload, { merge: true });
    return;
  }

  await collection.add(payload);
}

/**
 * Open socket, process the firehose, and reconnect with exponential backoff.
 */
function startListener() {
  const socket = new WebSocket(JETSTREAM_URL);

  socket.on("open", () => {
    reconnectDelay = RECONNECT_BASE_MS;
    console.log(`[jetstream] connected to ${JETSTREAM_URL}`);
  });

  socket.on("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      const post = extractPostRecord(message);
      if (!post) return;

      if (!REQUIRED_HASHTAG.test(post.text)) return;

      await saveEvent(message, post);
      console.log(`[saved] ${post.authorHandle} @ ${post.occurredAtIso}`);
    } catch (error) {
      console.error("[listener] failed to process message:", error);
    }
  });

  socket.on("error", (error) => {
    console.error("[jetstream] socket error:", error.message || error);
  });

  socket.on("close", (code, reasonBuffer) => {
    const reason = reasonBuffer ? reasonBuffer.toString() : "";
    console.warn(`[jetstream] closed (code=${code}, reason=${reason})`);

    const waitMs = reconnectDelay;
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);

    setTimeout(() => {
      console.log(`[jetstream] reconnecting in ${waitMs}ms`);
      startListener();
    }, waitMs);
  });
}

startListener();
