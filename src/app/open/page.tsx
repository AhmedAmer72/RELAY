import type { Metadata } from "next";
import { OpenInvoicesScreen } from "@/components/screens/open-screen";

export const metadata: Metadata = { title: "Open invoices" };

export default function OpenPage() {
  return <OpenInvoicesScreen />;
}
