import type { Metadata } from "next";
import { EscrowRoute } from "@/components/escrow-route";

export const metadata: Metadata = { title: "Agreement" };

export default async function EscrowPage({ params, searchParams }: { params: Promise<{ escrowId: string }>; searchParams: Promise<{ escrow?: string }> }) {
  const { escrowId } = await params;
  const { escrow } = await searchParams;
  return <EscrowRoute id={escrowId} variant="manage" contract={escrow} />;
}
