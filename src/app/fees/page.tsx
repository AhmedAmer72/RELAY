import type { Metadata } from "next";
import { FeesScreen } from "@/components/screens/fees-screen";

export const metadata: Metadata = { title: "Seller fees" };

export default function FeesPage() {
  return <FeesScreen />;
}
