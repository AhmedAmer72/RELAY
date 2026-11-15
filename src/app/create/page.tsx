import { Suspense } from "react";
import type { Metadata } from "next";
import { CreateScreen } from "@/components/screens/create-screen";

export const metadata: Metadata = { title: "Create checkout" };

export default function CreatePage() {
  return (
    <Suspense>
      <CreateScreen />
    </Suspense>
  );
}
