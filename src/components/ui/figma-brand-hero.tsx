"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

export default function FigmaBrandHero() {
  const [animationKey, setAnimationKey] = useState(0);

  return (
    <div
      key={animationKey}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-white px-4 py-6 sm:px-8"
    >
      <div className="relative flex w-full max-w-4xl flex-col items-center justify-center rounded-3xl border-2 border-[#163300] bg-[#f3f8ea] bg-[linear-gradient(to_right,#d7e4c4_1px,transparent_1px),linear-gradient(to_bottom,#d7e4c4_1px,transparent_1px)] bg-[size:24px_24px] px-6 py-8 shadow-[0_24px_60px_rgb(22_51_0_/_8%)] sm:px-12 sm:py-10">
        <div className="pointer-events-none absolute size-56 rounded-full bg-[#9fe870]/40 blur-3xl" />

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease }}
          className="relative z-10 mb-4 flex items-center gap-2 rounded-full border-2 border-[#163300] bg-white px-3.5 py-1 text-[11px] font-semibold text-[#163300]"
        >
          <span className="size-2 animate-pulse rounded-full bg-[#9fe870]" />
          Non-custodial MUSD checkout
        </motion.div>

        <div className="relative z-10 flex flex-col items-center text-center font-display text-3xl uppercase leading-[0.9] tracking-[-0.04em] text-[#163300] select-none sm:text-5xl md:text-6xl">
          <motion.span initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, delay: 0.15, ease }}>
            Secure
          </motion.span>
          <motion.span initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, delay: 0.25, ease }}>
            the deal.
          </motion.span>

          <div className="relative my-1.5 px-3 py-1">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, ease, delay: 0.35 }}
              className="absolute inset-0 origin-left border border-[#163300] bg-[#9fe870]"
            />
            {["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"].map((pos, index) => (
              <motion.span
                key={pos}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7 + index * 0.08, ease }}
                className={`absolute ${pos} z-20 size-2 border border-[#163300] bg-white`}
              />
            ))}
            <span className="relative z-10 text-[#163300]">Move the</span>
          </div>

          <motion.span initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, delay: 0.45, ease }}>
            value.
          </motion.span>
          <motion.span initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, delay: 0.55, ease }}>
            On Mezo.
          </motion.span>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: [0, 8, -4, 0], y: [0, -6, 3, 0] }}
          transition={{
            opacity: { duration: 0.8, delay: 0.6, ease },
            x: { duration: 6, repeat: Infinity, ease: "easeInOut" },
            y: { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
          className="pointer-events-none absolute top-8 right-6 z-30 hidden items-center sm:flex"
        >
          <Cursor className="fill-[#163300] text-[#163300]" />
          <div className="ml-1 flex items-center gap-1 rounded-md rounded-tl-none bg-[#163300] px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white shadow-md">
            <span>Buyer</span>
            <span className="text-[8px] font-normal opacity-75">Reading terms</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: -20 }}
          animate={{ opacity: 1, scale: 1, x: [0, -8, 6, 0], y: [0, 8, -4, 0] }}
          transition={{
            opacity: { duration: 0.8, delay: 0.7, ease },
            x: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
            y: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
          }}
          className="pointer-events-none absolute bottom-24 left-6 z-30 hidden items-center sm:flex"
        >
          <Cursor className="fill-[#9fe870] text-[#163300]" />
          <div className="ml-1 flex items-center gap-1 rounded-md rounded-tl-none border border-[#163300] bg-[#9fe870] px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-[#163300] shadow-md">
            <span>Seller</span>
            <span className="text-[8px] font-normal opacity-75">Awaiting delivery</span>
          </div>
        </motion.div>

        <motion.button
          type="button"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.65, ease }}
          onClick={() => setAnimationKey((value) => value + 1)}
          className="relative z-10 mt-6 cursor-pointer rounded-full bg-[#9fe870] px-5 py-1.5 text-[10px] font-black tracking-widest text-[#163300] uppercase shadow-sm transition-transform hover:scale-105 active:scale-95"
          title="Click to replay animation"
        >
          Fund. Deliver. Release. ⟳
        </motion.button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link href="/create" className="rounded-full border-2 border-transparent bg-[#9fe870] px-6 py-3 text-xs font-bold tracking-[0.14em] text-[#163300] uppercase hover:bg-[#8fdf55]">
          Create checkout
        </Link>
        <Link href="/dashboard" className="rounded-full border-2 border-[#163300] bg-white px-6 py-3 text-xs font-bold tracking-[0.14em] text-[#163300] uppercase hover:bg-[#f3f8ea]">
          Launch app
        </Link>
      </div>
    </div>
  );
}

function Cursor({ className }: { className: string }) {
  return (
    <svg className={`size-4 -rotate-12 drop-shadow ${className}`} viewBox="0 0 24 24" aria-hidden>
      <path d="M5.653 3.125a1 1 0 0 1 1.34-1.34l14.5 9.5a1 1 0 0 1 .046 1.705l-6.046 4.031-2.915 5.83a1 1 0 0 1-1.745.18l-3.5-5.5-5.228-2.614a1 1 0 0 1-.107-1.792l14.002-9.335z" />
    </svg>
  );
}
