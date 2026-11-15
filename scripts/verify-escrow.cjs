const fs = require("fs");
const path = require("path");

async function main() {
  const deployment = JSON.parse(fs.readFileSync(path.join(process.cwd(), "deployments", "mezo-testnet.json"), "utf8"));
  const address = deployment.address;
  const creationTransactionHash = deployment.deployTx;
  const dir = path.join(process.cwd(), "artifacts", "build-info");
  const artifact = JSON.parse(fs.readFileSync(path.join(process.cwd(), "artifacts", "contracts", "RelayEscrow.sol", "RelayEscrow.json"), "utf8"));
  const chosen = fs.readdirSync(dir).map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")))
    .filter((json) => json.output?.contracts?.["contracts/RelayEscrow.sol"]?.RelayEscrow?.evm?.deployedBytecode?.object?.length === artifact.deployedBytecode.length - 2)[0];
  if (!chosen) throw new Error("No build-info matches the deployed bytecode length.");
  const response = await fetch(`https://sourcify.dev/server/v2/verify/31611/${address}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      stdJsonInput: chosen.input,
      compilerVersion: chosen.solcLongVersion,
      contractIdentifier: "contracts/RelayEscrow.sol:RelayEscrow",
      creationTransactionHash,
    }),
  });
  const started = await response.json();
  console.log(response.status, JSON.stringify(started).slice(0, 500));
  if (!response.ok) process.exit(1);
  const job = started.verificationId;
  if (!job) throw new Error("Sourcify did not return a verification id.");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const check = await fetch(`https://sourcify.dev/server/v2/verify/${job}`);
    const body = await check.json();
    console.log(body.status || body.match || JSON.stringify(body).slice(0, 300));
    if (body.isJobCompleted || body.status === "perfect" || body.contract?.match) {
      const match = body.contract?.runtimeMatch || body.contract?.match || body.status;
      deployment.verification = {
        service: "sourcify",
        chainId: 31611,
        match,
        runtimeMatch: body.contract?.runtimeMatch,
        creationMatch: body.contract?.creationMatch,
        repo: `https://repo.sourcify.dev/contracts/full_match/31611/${address}/`,
      };
      fs.writeFileSync(path.join(process.cwd(), "deployments", "mezo-testnet.json"), JSON.stringify(deployment, null, 2) + "\n");
      if (match !== "exact_match" && body.contract?.runtimeMatch !== "exact_match") {
        throw new Error(`Sourcify finished without an exact match: ${match}`);
      }
      return;
    }
  }
  throw new Error("Sourcify did not finish in time.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
