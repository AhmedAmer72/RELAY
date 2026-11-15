import fs from "fs";
import path from "path";
import { contentId, isContentId } from "@/lib/evidence/cid";
import { evidencePath } from "@/lib/store/db";

const MAX_BYTES = 2 * 1024 * 1024;

async function pin(bytes: Uint8Array, cid: string) {
  if (process.env.PINATA_JWT) {
    const body = new FormData();
    body.append("file", new Blob([Buffer.from(bytes)]), cid);
    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
      body,
    });
    if (!response.ok) throw new Error("Pinata did not accept the file.");
    return true;
  }
  if (process.env.IPFS_API_URL) {
    const body = new FormData();
    body.append("file", new Blob([Buffer.from(bytes)]), cid);
    const response = await fetch(`${process.env.IPFS_API_URL.replace(/\/$/, "")}/api/v0/add`, { method: "POST", body });
    if (!response.ok) throw new Error("The IPFS API did not accept the file.");
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return Response.json({ error: "Choose a file between 1 byte and 2 MB." }, { status: 400 });
  }
  const cid = await contentId(bytes);
  const target = evidencePath(cid);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  let pinned = false;
  try {
    pinned = await pin(bytes, cid);
  } catch (error) {
    return Response.json({ cid, pinned: false, error: error instanceof Error ? error.message : "The file was stored here, but pinning failed." });
  }
  return Response.json({ cid, pinned });
}

export async function GET(request: Request) {
  const cid = new URL(request.url).searchParams.get("cid") ?? "";
  if (!isContentId(cid)) return Response.json({ error: "Unknown file." }, { status: 404 });
  const target = evidencePath(cid);
  if (!fs.existsSync(target)) return Response.json({ error: "That file is not stored on this host." }, { status: 404 });
  const bytes = fs.readFileSync(target);
  const actual = await contentId(bytes);
  if (actual !== cid) return Response.json({ error: "The stored file does not match its content id." }, { status: 409 });
  return new Response(Buffer.from(bytes), { headers: { "content-type": "application/octet-stream", "x-relay-cid": cid } });
}
