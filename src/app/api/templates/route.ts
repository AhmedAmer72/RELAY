import { listTemplates, saveTemplate, type SellerTemplate } from "@/lib/templates";

export async function GET(request: Request) {
  const seller = new URL(request.url).searchParams.get("seller") ?? "";
  return Response.json({ templates: listTemplates(seller) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { seller?: string; template?: SellerTemplate; signature?: `0x${string}` };
    if (!body.seller || !body.template || !body.signature) {
      return Response.json({ error: "A seller, template, and signature are required." }, { status: 400 });
    }
    const saved = await saveTemplate(body.seller, body.template, body.signature);
    return Response.json(saved);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The template could not be saved." }, { status: 400 });
  }
}
