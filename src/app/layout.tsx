import type { Metadata } from "next";
import { Archivo_Black, Inter } from "next/font/google";
import { AppShell } from "@/components/shell";
import { Providers } from "@/components/providers";
import { TAGLINE } from "@/lib/version";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `RELAY — ${TAGLINE}`, template: "%s · RELAY" },
  description: "RELAY is non-custodial protected MUSD checkout on Mezo. Secure the deal. Move the value.",
  applicationName: "RELAY",
  robots: { index: false, follow: false },
  openGraph: {
    title: `RELAY — ${TAGLINE}`,
    description: "Payments that follow the agreement. Fund MUSD in escrow, deliver, and settle under on-chain rules.",
    siteName: "RELAY",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
