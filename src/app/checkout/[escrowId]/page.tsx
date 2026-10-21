import type { Metadata } from "next";
import { EscrowRoute } from "@/components/escrow-route";

export const metadata: Metadata = { title: "Protected checkout" };

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ escrowId: string }>; searchParams: Promise<{ escrow?: string }> }) {
  const { escrowId } = await params;
  const { escrow } = await searchParams;
  return <EscrowRoute id={escrowId} variant="checkout" contract={escrow} />;
}
