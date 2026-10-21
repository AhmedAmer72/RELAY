import type { Metadata } from "next";
import { LandingScreen } from "@/components/screens/landing-screen";

export const metadata: Metadata = { title: "RELAY — Secure the deal. Move the value." };

export default function HomePage() {
  return <LandingScreen />;
}
