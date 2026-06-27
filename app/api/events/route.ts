import { NextResponse } from "next/server";
import { createEvent } from "@/lib/events";

const MAX_TEXT_LENGTH = 500;
const MIN_TEXT_LENGTH = 5;
const MAX_HANDLE_LENGTH = 80;

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidHandle(handle: string): boolean {
  const normalized = handle.startsWith("@") ? handle.slice(1) : handle;
  if (!normalized || normalized.length > MAX_HANDLE_LENGTH) {
    return false;
  }

  const parts = normalized.split(".");
  if (parts.some((part) => part.length === 0)) {
    return false;
  }

  return parts.every((part) => /^[a-z0-9_-]+$/i.test(part));
}

/**
 * Accept form submissions so demo users can create events directly from the UI.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const text = asString(formData.get("text"));
  const authorHandle = asString(formData.get("authorHandle"));
  const occurredAtLocal = asString(formData.get("occurredAt"));

  const redirectUrl = new URL("/", request.url);

  if (text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH) {
    redirectUrl.searchParams.set(
      "error",
      `Event text must be between ${MIN_TEXT_LENGTH} and ${MAX_TEXT_LENGTH} characters.`,
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (!authorHandle || authorHandle.length > MAX_HANDLE_LENGTH || !isValidHandle(authorHandle)) {
    redirectUrl.searchParams.set("error", "Author handle is invalid.");
    return NextResponse.redirect(redirectUrl);
  }

  let occurredAtIso: string | undefined;
  if (occurredAtLocal) {
    const parsedDate = new Date(occurredAtLocal);
    if (Number.isNaN(parsedDate.getTime())) {
      redirectUrl.searchParams.set("error", "Event time is invalid.");
      return NextResponse.redirect(redirectUrl);
    }
    occurredAtIso = parsedDate.toISOString();
  }

  try {
    await createEvent({
      text,
      authorHandle,
      occurredAtIso,
      city: "Wichita",
    });

    redirectUrl.searchParams.set("submitted", "1");
    return NextResponse.redirect(redirectUrl);
  } catch {
    redirectUrl.searchParams.set("error", "Could not submit event. Please try again.");
    return NextResponse.redirect(redirectUrl);
  }
}
