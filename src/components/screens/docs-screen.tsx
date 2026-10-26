import Link from "next/link";
import { DOC_LIMITATIONS, DOC_SECTIONS, DOC_STATES } from "@/lib/docs-content";
import { OFFICIAL_LINKS, VERIFIED_TESTNET, explorerAddressUrl, getAppChain, getChainEnv, getDeployBlock, getEscrowAddresses, getEscrowConfig, getMusdConfig } from "@/lib/chain/config";
import { ExternalLink } from "@/components/ui";

const PITCH_DECK_FILE = "/pitch/RELAY_Mezo_Buildathon_Pitch_Deck.pptx";

export function DocsScreen() {
  const escrow = getEscrowConfig();
  const musd = getMusdConfig();
  const chain = getAppChain();
  const addresses = getEscrowAddresses();
  const primary = escrow.address;
  const earlier = addresses.filter((item) => !primary || item.toLowerCase() !== primary.toLowerCase());
  const escrowUrl = explorerAddressUrl(escrow.address);
  const musdUrl = explorerAddressUrl(musd.address);

  return (
    <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      <nav aria-label="Documentation sections" className="mb-8 lg:sticky lg:top-24 lg:mb-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">On this page</p>
        <ol className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          <li className="shrink-0">
            <a href="#pitch-deck" className="block rounded-full px-3 py-1.5 text-sm font-semibold text-[#163300] hover:bg-[#f3f8ea] lg:rounded-2xl">Pitch deck</a>
          </li>
          {DOC_SECTIONS.map((section, index) => (
            <li key={section.id} className="shrink-0">
              <a href={`#${section.id}`} className="block rounded-full px-3 py-1.5 text-sm font-semibold text-[#163300] hover:bg-[#f3f8ea] lg:rounded-2xl">
                <span className="mr-2 font-mono text-xs text-faint">{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </a>
            </li>
          ))}
          <li className="shrink-0">
            <a href="#states" className="block rounded-full px-3 py-1.5 text-sm font-semibold text-[#163300] hover:bg-[#f3f8ea] lg:rounded-2xl">
              <span className="mr-2 font-mono text-xs text-faint">{String(DOC_SECTIONS.length + 1).padStart(2, "0")}</span>
              States
            </a>
          </li>
          <li className="shrink-0">
            <a href="#deployment" className="block rounded-full px-3 py-1.5 text-sm font-semibold text-[#163300] hover:bg-[#f3f8ea] lg:rounded-2xl">
              <span className="mr-2 font-mono text-xs text-faint">{String(DOC_SECTIONS.length + 2).padStart(2, "0")}</span>
              This deployment
            </a>
          </li>
          <li className="shrink-0">
            <a href="#limitations" className="block rounded-full px-3 py-1.5 text-sm font-semibold text-[#163300] hover:bg-[#f3f8ea] lg:rounded-2xl">
              <span className="mr-2 font-mono text-xs text-faint">{String(DOC_SECTIONS.length + 3).padStart(2, "0")}</span>
              Limitations
            </a>
          </li>
        </ol>
      </nav>

      <div className="min-w-0 space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Contract rules</p>
          <h1 className="display-title mt-1">Documentation</h1>
          <p className="mt-3 max-w-2xl text-base text-muted">How an agreement moves from creation to a final payment, refund, or split. The connected contract is the source of the funds and the status.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
            <Link className="rounded-full bg-[#f3f8ea] px-3 py-1.5 text-brand" href="/create">Create</Link>
            <Link className="rounded-full bg-[#f3f8ea] px-3 py-1.5 text-brand" href="/agents">Agent budgets</Link>
            <Link className="rounded-full bg-[#f3f8ea] px-3 py-1.5 text-brand" href="/how-it-works">How it works</Link>
            <Link className="rounded-full bg-[#f3f8ea] px-3 py-1.5 text-brand" href="/settings">Network</Link>
          </div>
        </header>

        <section id="pitch-deck" className="scroll-mt-28 rounded-[28px] border-2 border-[#163300] bg-[#f3f8ea] p-5 target:ring-4 target:ring-meadow sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Mezo Buildathon</p>
          <h2 className="mt-1 text-xl font-semibold">Pitch deck</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Ten slides for the testnet checkout: the problem, the escrow rules, what is live, and the next wave. The file is the PowerPoint deck in this project.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={PITCH_DECK_FILE} className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-white">Open pitch deck</a>
            <a href={PITCH_DECK_FILE} download className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-[#163300] bg-white px-5 text-sm font-semibold text-[#163300]">Download .pptx</a>
          </div>
        </section>

        {DOC_SECTIONS.map((section, index) => (
          <section id={section.id} key={section.id} className="scroll-mt-28 rounded-[28px] border border-line bg-white p-5 target:border-[#163300] target:ring-4 target:ring-meadow sm:p-6">
            <p className="font-mono text-xs font-semibold text-faint">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-1 text-xl font-semibold">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{section.lead}</p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-ink">
              {section.points.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-meadow" aria-hidden />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section id="states" className="scroll-mt-28 rounded-[28px] border border-line bg-white p-5 target:border-[#163300] target:ring-4 target:ring-meadow sm:p-6">
          <p className="font-mono text-xs font-semibold text-faint">{String(DOC_SECTIONS.length + 1).padStart(2, "0")}</p>
          <h2 className="mt-1 text-xl font-semibold">States</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Released, Refunded, Cancelled, and Split are final. A dispute is not final until the resolver settles it.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-faint">
                  <th className="py-2 pr-3 font-semibold">From</th>
                  <th className="py-2 pr-3 font-semibold">To</th>
                  <th className="py-2 pr-3 font-semibold">Who</th>
                  <th className="py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {DOC_STATES.map((row) => (
                  <tr key={`${row.from}-${row.to}-${row.when}`} className="border-b border-line align-top">
                    <td className="py-3 pr-3 font-semibold">{row.from}</td>
                    <td className="py-3 pr-3 font-semibold">{row.to}</td>
                    <td className="py-3 pr-3 text-muted">{row.by}</td>
                    <td className="py-3 text-muted">{row.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="deployment" className="scroll-mt-28 rounded-[28px] border border-line bg-white p-5 target:border-[#163300] target:ring-4 target:ring-meadow sm:p-6">
          <p className="font-mono text-xs font-semibold text-faint">{String(DOC_SECTIONS.length + 2).padStart(2, "0")}</p>
          <h2 className="mt-1 text-xl font-semibold">This deployment</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {getChainEnv() === "local"
              ? "This build is pointed at a local Hardhat chain. Addresses come from the local environment."
              : `${VERIFIED_TESTNET.name} is chain ${chain.id}. New checkouts use the current escrow. Earlier agreements stay on the contracts that created them.`}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-faint">Network</dt><dd className="text-right font-semibold">{getChainEnv() === "local" ? "Local Hardhat" : chain.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-faint">Chain ID</dt><dd className="num text-right">{chain.id}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-faint">Gas token</dt><dd className="text-right">{chain.nativeCurrency.symbol}, {chain.nativeCurrency.decimals} decimals</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-faint">MUSD</dt><dd className="num max-w-[70%] break-all text-right">{musd.address ?? musd.error ?? "Not configured"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-faint">Current escrow</dt><dd className="num max-w-[70%] break-all text-right">{escrow.address ?? escrow.error ?? "Not configured"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-faint">Index from block</dt><dd className="num text-right">{getDeployBlock()?.toString() ?? "Not set"}</dd></div>
          </dl>
          {earlier.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-semibold">Earlier escrows still read by the app</p>
              <ul className="mt-2 space-y-1 text-sm">
                {earlier.map((item) => (
                  <li key={item} className="num break-all text-muted">{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-4 space-y-2 text-sm">
            {musdUrl ? <p><ExternalLink href={musdUrl}>MUSD on the explorer</ExternalLink></p> : null}
            {escrowUrl ? <p><ExternalLink href={escrowUrl}>Current escrow on the explorer</ExternalLink></p> : null}
            <p><ExternalLink href={OFFICIAL_LINKS.contracts}>Official token address reference</ExternalLink></p>
            <p><ExternalLink href={OFFICIAL_LINKS.network}>Official network configuration</ExternalLink></p>
            <p><ExternalLink href={OFFICIAL_LINKS.musdQuickstart}>Testnet MUSD quickstart</ExternalLink></p>
            <p><ExternalLink href={OFFICIAL_LINKS.faucet}>Testnet BTC faucet</ExternalLink></p>
            <p><ExternalLink href={OFFICIAL_LINKS.borrow}>Borrow testnet MUSD</ExternalLink></p>
          </div>
        </section>

        <section id="limitations" className="scroll-mt-28 rounded-[28px] border border-line bg-white p-5 target:border-[#163300] target:ring-4 target:ring-meadow sm:p-6">
          <p className="font-mono text-xs font-semibold text-faint">{String(DOC_SECTIONS.length + 3).padStart(2, "0")}</p>
          <h2 className="mt-1 text-xl font-semibold">Limitations</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
            {DOC_LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
