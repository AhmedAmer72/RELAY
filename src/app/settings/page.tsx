import type { Metadata } from "next";
import { SettingsScreen } from "@/components/screens/info-screens";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsScreen />;
}
