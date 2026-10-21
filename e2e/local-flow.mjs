import { spawn } from "node:child_process";

const child = spawn(
  "npx",
  ["hardhat", "test", "--grep", "full protected payment and an independent refund"],
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, TS_NODE_PROJECT: "tsconfig.hardhat.json" },
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
