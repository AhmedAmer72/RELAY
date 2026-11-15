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
      className="relative w-full bg-[#f3f8ea] bg-[linear-gradient(to_right,#d7e4c4_1px,transparent_1px),linear-gradient(to_bottom,#d7e4c4_1px,transparent_1px)] bg-[size:24px_24px]"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center px-6 py-20">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease }}
          className="mb-5 flex items-center gap-2 rounded-full border-2 border-[#163300] bg-white px-3.5 py-1 text-[11px] font-semibold text-[#163300]"
        >
          <span className="size-2 animate-pulse rounded-full bg-[#9fe870]" />
          Non-custodial MUSD checkout
        </motion.div>

        <div
          className="flex flex-col items-center text-center font-display uppercase leading-[0.95] tracking-[-0.04em] text-[#163300] select-none"
          style={{ fontSize: "clamp(2.5rem, 7vw, 6rem)" }}
        >
          <motion.span initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, delay: 0.15, ease }}>
            Secure
          </motion.span>
          <motion.span initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, delay: 0.25, ease }}>
            the deal.
          </motion.span>

          <div className="relative my-4 px-4 py-2">
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
        </div>

        <motion.button
          type="button"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.65, ease }}
          onClick={() => setAnimationKey((value) => value + 1)}
          className="mt-5 cursor-pointer rounded-full bg-[#9fe870] px-5 py-2 text-[10px] font-black tracking-widest text-[#163300] uppercase shadow-sm transition-transform hover:scale-105 active:scale-95"
          title="Click to replay animation"
        >
          Fund. Deliver. Release. ⟳
        </motion.button>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3.5">
          <Link href="/create" className="rounded-full border-2 border-transparent bg-[#9fe870] px-6 py-3 text-xs font-bold tracking-[0.14em] text-[#163300] uppercase hover:bg-[#8fdf55]">
            Create checkout
          </Link>
          <Link href="/dashboard" className="rounded-full border-2 border-[#163300] bg-white px-6 py-3 text-xs font-bold tracking-[0.14em] text-[#163300] uppercase hover:bg-[#f3f8ea]">
            Launch app
          </Link>
        </div>

        <div className="mt-6 hidden w-full items-center justify-center gap-4 md:flex">
          <RoleChip tone="buyer" name="Buyer" detail="Reading terms" />
          <RoleChip tone="seller" name="Seller" detail="Awaiting delivery" />
        </div>
      </div>
    </div>
  );
}

function RoleChip({ tone, name, detail }: { tone: "buyer" | "seller"; name: string; detail: string }) {
  const buyer = tone === "buyer";
  return (
    <div className={`flex items-center rounded-md px-3 py-1.5 text-[13px] font-bold shadow-sm ${buyer ? "bg-[#163300] text-white" : "border border-[#163300] bg-[#9fe870] text-[#163300]"}`}>
      <Cursor className={buyer ? "fill-white text-white" : "fill-[#163300] text-[#163300]"} />
      <span className="ml-2">{name}</span>
      <span className="ml-2 text-[13px] font-normal opacity-75">{detail}</span>
    </div>
  );
}

function Cursor({ className }: { className: string }) {
  return (
    <svg className={`size-4 -rotate-12 ${className}`} viewBox="0 0 24 24" aria-hidden>
      <path d="M5.653 3.125a1 1 0 0 1 1.34-1.34l14.5 9.5a1 1 0 0 1 .046 1.705l-6.046 4.031-2.915 5.83a1 1 0 0 1-1.745.18l-3.5-5.5-5.228-2.614a1 1 0 0 1-.107-1.792l14.002-9.335z" />
    </svg>
  );
}
