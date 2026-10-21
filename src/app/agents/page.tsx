import type { Metadata } from "next";
import { AgentsScreen } from "@/components/screens/agent-budget";

export const metadata: Metadata = { title: "Agent budgets" };

export default function AgentsPage() {
  return <AgentsScreen />;
}
