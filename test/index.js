const path = require("path");

require("ts-node").register({
  transpileOnly: true,
  project: path.join(__dirname, "..", "tsconfig.hardhat.json"),
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node",
    esModuleInterop: true,
  },
});

require("./RelayEscrow.ts");
