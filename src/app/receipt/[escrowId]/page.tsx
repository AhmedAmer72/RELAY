import type { Metadata } from "next";
import { EscrowRoute } from "@/components/escrow-route";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ escrowId: string }>; searchParams: Promise<{ escrow?: string }> }) {
  const { escrowId } = await params;
  const { escrow } = await searchParams;
  return <EscrowRoute id={escrowId} variant="receipt" contract={escrow} />;
}
