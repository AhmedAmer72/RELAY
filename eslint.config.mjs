import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      "contracts/**",
      "artifacts/**",
      "cache/**",
      "test/**",
      "scripts/**",
      "e2e/**",
      "coverage/**",
      ".next/**",
      "typechain-types/**",
      "dist-hardhat/**",
      "next-env.d.ts",
      "hardhat.config.cjs",
      "**/*.cjs",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
