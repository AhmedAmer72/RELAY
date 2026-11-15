import type { Metadata } from "next";
import { PitchDeck } from "@/components/pitch/pitch-deck";

export const metadata: Metadata = {
  title: "Pitch deck",
  description: "RELAY on Mezo Testnet: a non-custodial MUSD checkout. The escrow holds the tokens. The site prepares the transaction.",
};

export default function PitchPage() {
  return <PitchDeck />;
}
