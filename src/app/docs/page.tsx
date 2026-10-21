import type { Metadata } from "next";
import { DocsScreen } from "@/components/screens/info-screens";

export const metadata: Metadata = { title: "Documentation" };

export default function DocsPage() {
  return <DocsScreen />;
}
