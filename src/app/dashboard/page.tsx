import type { Metadata } from "next";
import { DashboardScreen } from "@/components/screens/dashboard-screen";

export const metadata: Metadata = { title: "Your checkouts" };

export default function DashboardPage() {
  return <DashboardScreen />;
}
