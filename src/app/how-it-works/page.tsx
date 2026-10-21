import type { Metadata } from "next";
import { HowItWorksScreen } from "@/components/screens/info-screens";

export const metadata: Metadata = { title: "How it works" };

export default function HowPage() {
  return <HowItWorksScreen />;
}
