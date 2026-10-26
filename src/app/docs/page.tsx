import type { Metadata } from "next";
import { DocsScreen } from "@/components/screens/docs-screen";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Agreement states, funding, delivery, disputes, agent budgets, and the Mezo Testnet deployment.",
};

export default function DocsPage() {
  return <DocsScreen />;
}
