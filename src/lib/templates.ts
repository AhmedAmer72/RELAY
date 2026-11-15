import { getAddress, isAddress, verifyMessage } from "viem";
import { randomBytes } from "crypto";
import { canonicalTemplate, templateMessage, validTemplate, type SellerTemplate } from "@/lib/templates-shared";
import { readDb, withLock, writeDb } from "@/lib/store/db";

export type { SellerTemplate };

export async function saveTemplate(seller: string, template: SellerTemplate, signature: `0x${string}`) {
  if (!isAddress(seller) || !validTemplate(template)) throw new Error("The template is incomplete.");
  const json = canonicalTemplate(template);
  const owner = getAddress(seller);
  const valid = await verifyMessage({ address: owner, message: templateMessage(owner, json), signature });
  if (!valid) throw new Error("The template signature does not match this wallet.");
  const id = randomBytes(8).toString("hex");
  await withLock(() => {
    const db = readDb();
    const mine = db.templates.filter((item) => item.seller === owner);
    db.templates = [{ id, seller: owner, json, createdAt: new Date().toISOString() }, ...mine.filter((item) => item.json !== json), ...db.templates.filter((item) => item.seller !== owner)].slice(0, 100);
    writeDb(db);
  });
  return { id };
}

export function listTemplates(seller: string) {
  if (!isAddress(seller)) return [];
  const owner = getAddress(seller);
  return readDb().templates.filter((item) => item.seller === owner).map((item) => ({ id: item.id, json: item.json, createdAt: item.createdAt }));
}
