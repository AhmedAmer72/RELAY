import { registerAlert } from "@/lib/index/webhooks";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: string; owner?: string; signature?: `0x${string}` };
    if (!body.url || !body.owner || !body.signature) {
      return Response.json({ error: "A URL, wallet, and signature are required." }, { status: 400 });
    }
    const created = await registerAlert({ url: body.url, owner: body.owner, signature: body.signature });
    return Response.json(created);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The alert could not be saved." }, { status: 400 });
  }
}
