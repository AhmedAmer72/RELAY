import { MAX_EVIDENCE_BYTES, MAX_REASON_BYTES } from "@/lib/escrow/constants";
import { buildEvidence, buildReason, safeHttpsUrl, utf8Size } from "@/lib/metadata/canonical";

export function validateEvidence(note: string, url: string, file?: string) {
  const errors: { note?: string; url?: string; file?: string } = {};
  const trimmedNote = note.trim();
  const trimmedUrl = url.trim();
  if (trimmedNote.length < 3) errors.note = "Add a delivery note of at least 3 characters.";
  if (!safeHttpsUrl(trimmedUrl)) errors.url = "Use an https link, or leave the URL empty.";
  if (file && !/^b[a-z2-7]{20,}$/.test(file)) errors.file = "The file content id is not valid.";
  const built = buildEvidence({ note: trimmedNote, url: trimmedUrl, file: file || undefined });
  if (!errors.note && utf8Size(built.json) > MAX_EVIDENCE_BYTES) errors.note = "The evidence record is too long to store on-chain.";
  return { errors, valid: !errors.note && !errors.url, ...built };
}

export function validateReason(reason: string, file?: string) {
  const trimmed = reason.trim();
  const body = file ? `${trimmed}\nfile:${file}` : trimmed;
  if (!trimmed) return { ok: false as const, error: "Describe the dispute. Do not include secrets or personal data." };
  if (file && !/^b[a-z2-7]{20,}$/.test(file)) return { ok: false as const, error: "The file content id is not valid." };
  if (utf8Size(body) > MAX_REASON_BYTES) return { ok: false as const, error: "Keep the reason and file id within 280 bytes. They are stored publicly on-chain." };
  return { ok: true as const, error: undefined, ...buildReason(body) };
}
