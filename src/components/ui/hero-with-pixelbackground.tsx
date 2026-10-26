"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { getAppChain, getChainEnv } from "@/lib/chain/config";
import { MezoMark } from "@/components/mezo-mark";
import { Timeline, TimelineText } from "@/components/ui/hero-with-pixelbackground-utils/timeline";
import PixelBackground from "@/components/ui/hero-with-pixelbackground-utils/pixel-background";

const ease = [0.22, 1, 0.36, 1] as const;

export default function HeroSectionwithPixelBackground() {
  const chain = getAppChain();
  const env = getChainEnv();
  const place = env === "local" ? "Local dev chain" : chain.name;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
        }}
      >
        <PixelBackground
          gap={6}
          speed={55}
          colors="#e7f0dc,#d5e4c4,#c5d7b0,#9fe870"
          opacity={0.85}
          direction="top"
          className="h-full w-full"
        />
      </div>

      <div className="relative flex h-full min-h-0 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="mb-6 flex items-center gap-2 sm:mb-8"
        >
          {env === "local" ? null : <MezoMark className="size-5" />}
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-faint">{place}</span>
          <span className="h-px w-8 bg-line" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-faint">No protocol fee</span>
        </motion.div>

        <h1 className="flex flex-col items-center gap-1 text-center font-display uppercase leading-[0.84] tracking-[-0.045em] text-ink">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease }}
            className="text-[clamp(2.6rem,9vw,7.5rem)]"
          >
            Secure
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease }}
            className="text-[clamp(2.6rem,9vw,7.5rem)]"
          >
            the deal.
          </motion.span>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease }}
            className="mt-1 max-w-full"
          >
            <Timeline
              rotation={-1.1}
              initialLeft={8}
              minWidth={64}
              containerClassName="bg-white"
              handleClassName="border-meadow bg-white"
              handleIndicatorClassName="bg-brand"
            >
              <TimelineText className="px-8 py-2 text-[clamp(1.35rem,6vw,7rem)] text-brand">Move the value.</TimelineText>
            </Timeline>
          </motion.div>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.52, ease: "easeOut" }}
          className="mt-8 max-w-md text-center text-sm leading-relaxed text-muted sm:mt-10 sm:text-base"
        >
          A seller sets the terms. The buyer funds MUSD into escrow. Release, refund, dispute, and split follow the deadlines on that agreement.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.68, ease: "easeOut" }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/create"
            className="border-2 border-meadow bg-meadow px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-brand transition-colors duration-300 hover:border-[#8fdf55] hover:bg-[#8fdf55] sm:px-8"
          >
            Create checkout
          </Link>
          <Link
            href="/dashboard"
            className="border-2 border-line px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-muted transition-colors duration-300 hover:border-brand hover:text-ink sm:px-8"
          >
            Launch app
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
