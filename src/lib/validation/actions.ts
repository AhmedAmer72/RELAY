import { MAX_EVIDENCE_BYTES, MAX_REASON_BYTES } from "@/lib/escrow/constants";
import { buildEvidence, buildReason, safeHttpsUrl, utf8Size } from "@/lib/metadata/canonical";

export function validateEvidence(note: string, url: string) {
  const errors: { note?: string; url?: string } = {};
  const trimmedNote = note.trim();
  const trimmedUrl = url.trim();
  if (trimmedNote.length < 3) errors.note = "Add a delivery note of at least 3 characters.";
  if (!safeHttpsUrl(trimmedUrl)) errors.url = "Use an https link, or leave the URL empty.";
  const built = buildEvidence({ note: trimmedNote, url: trimmedUrl });
  if (!errors.note && utf8Size(built.json) > MAX_EVIDENCE_BYTES) errors.note = "The evidence record is too long to store on-chain.";
  return { errors, valid: !errors.note && !errors.url, ...built };
}

export function validateReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false as const, error: "Describe the dispute. Do not include secrets or personal data." };
  if (utf8Size(trimmed) > MAX_REASON_BYTES) return { ok: false as const, error: "Keep the reason within 280 bytes. It is stored publicly on-chain." };
  return { ok: true as const, error: undefined, ...buildReason(trimmed) };
}
