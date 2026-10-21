import type { Metadata } from "next";
import { SellerScreen } from "@/components/screens/seller-screen";

export const metadata: Metadata = { title: "Seller" };

export default async function SellerPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <SellerScreen address={address} />;
}
