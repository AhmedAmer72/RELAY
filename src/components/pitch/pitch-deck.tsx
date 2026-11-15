"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./pitch-deck.module.css";

const EXPLORER = "https://explorer.test.mezo.org";

function tx(hash: string, label: string) {
  return (
    <a className={styles.tx} href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function address(value: string) {
  return (
    <a className={styles.tx} href={`${EXPLORER}/address/${value}`} target="_blank" rel="noreferrer">
      {`${value.slice(0, 6)}…${value.slice(-4)}`}
    </a>
  );
}

const SLIDE_COUNT = 10;

export function PitchDeck() {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, next));
    setIndex(clamped);
    const hash = `#${clamped + 1}`;
    if (window.location.hash !== hash) history.replaceState(null, "", hash);
  }, []);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    const fromHash = Number.parseInt(window.location.hash.slice(1), 10);
    if (Number.isInteger(fromHash)) go(fromHash - 1);
    return () => window.removeEventListener("resize", fit);
  }, [go]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        go(index + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(event.key)) {
        event.preventDefault();
        go(index - 1);
      } else if (event.key === "Home") go(0);
      else if (event.key === "End") go(SLIDE_COUNT - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  const slides = [
    <section key="title" className={styles.slide}>
      <div className={styles.kicker}><span>RELAY</span><span>Mezo Testnet</span></div>
      <h1 className={`${styles.display} ${styles.h1}`}>Secure the deal. <span className={styles.em}>Move the value.</span></h1>
      <p className={styles.sub}>A non-custodial MUSD checkout. The escrow contract holds the tokens. This site prepares the transaction and reads the result. It has no key that can withdraw them.</p>
      <div className={styles.chips}>
        <span className={styles.chip}>Chain 31611</span>
        <span className={styles.chip}>Gas is BTC</span>
        <span className={styles.chip}>Mainnet is off</span>
        <span className={styles.chip}>Not audited</span>
      </div>
      <aside className={styles.heroCard}>
        <p className={styles.heroLabel}>Current escrow</p>
        <p className={styles.heroTitle}>One signature. Then the funds are locked.</p>
        <p className={styles.heroRow}><span>Fee on a seller payout</span><span className={styles.mono}>0.50%</span></p>
        <p className={styles.heroRow}><span>Refunds</span><span className={styles.mono}>Whole</span></p>
        <p className={styles.heroRow}><span>Contract</span><span className={styles.mono}>{address("0x069eef42fb0BaffFfFdCd7755e6e21E37299365d")}</span></p>
      </aside>
    </section>,
    <section key="problem" className={styles.slide}>
      <div className={styles.kicker}><span>02 · Problem</span><span>Why a transfer is not a deal</span></div>
      <div className={styles.cols}>
        <div>
          <h2 className={`${styles.display} ${styles.h2}`}>Sending MUSD does not make an agreement.</h2>
          <div className={styles.list}>
            <p className={styles.listItem}><span className={styles.num}>01</span><span>A plain transfer has no delivery deadline, no review window, and no named resolver.</span></p>
            <p className={styles.listItem}><span className={styles.num}>02</span><span>A platform that custodies the balance can move it without either party.</span></p>
            <p className={styles.listItem}><span className={styles.num}>03</span><span>MUSD sent straight to the escrow address is not credited. There is no rescue function.</span></p>
          </div>
        </div>
        <div className={styles.paper}>
          <p className={styles.heroLabel}>Direct transfer</p>
          <p className={`${styles.display}`} style={{ fontSize: 48, marginTop: 8 }}>Blank send</p>
          <table>
            <tbody>
              <tr><td>Amount</td><td>whatever arrived</td></tr>
              <tr><td>Deadline</td><td>none</td></tr>
              <tr><td>Review</td><td>none</td></tr>
              <tr><td>Resolver</td><td>none</td></tr>
            </tbody>
          </table>
          <div className={styles.stamp}>NOT A DEAL</div>
        </div>
      </div>
    </section>,
    <section key="solution" className={styles.slide}>
      <div className={styles.kicker}><span>03 · The contract</span><span>RelayEscrow</span></div>
      <h2 className={`${styles.display} ${styles.h2}`}>The contract decides. The website cannot.</h2>
      <div className={styles.grid}>
        <article className={styles.card}><p className={styles.num}>01 · AMOUNT</p><h3>Exact pull</h3><p>Funding moves the stored amount. A token that delivers a different balance is rejected.</p></article>
        <article className={styles.card}><p className={styles.num}>02 · CLOCK</p><h3>Deadlines</h3><p>Funding closes on its deadline. Delivery, review, refund, and finalizing each check the clock.</p></article>
        <article className={styles.card}><p className={styles.num}>03 · DISPUTE</p><h3>Named resolver</h3><p>Only that address can pay one side or split a dispute. The app does not judge the work.</p></article>
        <article className={styles.card}><p className={styles.num}>04 · CUSTODY</p><h3>No admin key</h3><p>There is no function that sweeps a balance or changes the parties after creation.</p></article>
      </div>
      <p className={styles.callout}>States: Created, Funded, Delivered, Released, Refunded, Disputed, Cancelled, Split. Released, Refunded, Cancelled, and Split are final.</p>
    </section>,
    <section key="flow" className={styles.slide}>
      <div className={styles.kicker}><span>04 · A payment</span><span>From a link to a receipt</span></div>
      <h2 className={`${styles.display} ${styles.h2}`}>Five steps. Tokens move only when the contract allows it.</h2>
      <div className={styles.steps}>
        <article className={styles.step}><p className={styles.num}>01</p><h3>Create</h3><p>The seller sets the amount, deadlines, review window, and resolver. Creation does not move MUSD.</p></article>
        <article className={styles.step}><p className={styles.num}>02</p><h3>Read</h3><p>The buyer can open the checkout before connecting. A named buyer accepts the resolver first.</p></article>
        <article className={styles.step}><p className={styles.num}>03</p><h3>Fund</h3><p>On the current escrow, one Permit2 signature and one transaction. Older escrows still approve, then fund.</p></article>
        <article className={styles.step}><p className={styles.num}>04</p><h3>Deliver</h3><p>A note and an optional link. The contract stores the text and a hash. The hash does not prove the work.</p></article>
        <article className={styles.step}><p className={styles.num}>05</p><h3>Settle</h3><p>The buyer releases, a missed deadline refunds, review can finalize, or the resolver splits a dispute.</p></article>
      </div>
    </section>,
    <section key="permit" className={styles.slide}>
      <div className={styles.kicker}><span>05 · Funding</span><span>Current escrow only</span></div>
      <div className={styles.cols}>
        <div>
          <h2 className={`${styles.display} ${styles.h2}`}>Sign and fund. No second approval of the escrow.</h2>
          <p className={styles.lead}>The buyer signs a Permit2 allowance and the same transaction pulls the exact MUSD into escrow. If Permit2 has never been allowed to move that wallet’s MUSD, that allowance is a separate one-time step. It is not an approval of the escrow.</p>
          <p className={styles.callout}>Older deployments do not have this function. Their checkout keeps Approve MUSD, then Fund escrow. Agent funding still uses the buyer’s approval of the escrow.</p>
        </div>
        <div className={styles.paper}>
          <p className={styles.heroLabel}>Live on testnet</p>
          <p className={styles.display} style={{ fontSize: 40, marginTop: 10 }}>Agreement 1 · 1 MUSD</p>
          <p className={styles.heroRow}><span>Event</span><span>EscrowFunded</span></p>
          <p className={styles.heroRow}><span>Buyer</span><span className={styles.mono}>0x39B6…9685</span></p>
          <p className={styles.heroRow}><span>Transaction</span><span>{tx("0x4191b7b003951e95a17536c887834a755dcd8daf1e8c52ae62d52a885e9c2b1c", "0x4191…2b1c")}</span></p>
        </div>
      </div>
    </section>,
    <section key="rules" className={styles.slide}>
      <div className={styles.kicker}><span>06 · Rules with receipts</span><span>Each hash names its contract</span></div>
      <h2 className={`${styles.display} ${styles.h2}`} style={{ fontSize: 56 }}>The fee is charged when the seller is paid. A refund stays whole.</h2>
      <table className={styles.proof}>
        <thead><tr><th>What happened</th><th>Where</th><th>Result</th></tr></thead>
        <tbody>
          <tr><td>Release of 4 MUSD, seller received 3.98, fee 0.02</td><td>Previous escrow {address("0x7b31489D0da4b745E26689647FC1514071De3fD4")}</td><td>{tx("0xffac7be42e45fa4da98d62f3b8d2a7a67ffb40caffb6d98ddad4d8c161817f73", "success")}</td></tr>
          <tr><td>Full 4 MUSD refund after a missed delivery</td><td>Previous escrow {address("0x7b31489D0da4b745E26689647FC1514071De3fD4")}</td><td>{tx("0xdfe8ab2cddb16c3efcec815ea39d3730c9fd8ac212b7f655b6cf785fee365f5a", "success")}</td></tr>
          <tr><td>Resolver split, 0.01 MUSD fee on the seller’s 2 MUSD</td><td>Previous escrow {address("0x7b31489D0da4b745E26689647FC1514071De3fD4")}</td><td>{tx("0x1b1b90b6e525e42e5c2bb02e3a3a7723db97cc80a4a9f44fb912ec6eb1db8350", "success")}</td></tr>
          <tr><td>Both parties cancelled. Buyer received the full amount</td><td>Earlier escrow {address("0x50ab19e57dff6f2De6e8f3A17EF96417f39cB793")}</td><td>{tx("0x79d31e9051180978de25426be472dcd652116b82da5f752c48d952afedad8a8b", "success")}</td></tr>
          <tr><td>Second milestone funded only after the first was released</td><td>Previous escrow {address("0x7b31489D0da4b745E26689647FC1514071De3fD4")}</td><td>{tx("0x90ef98a3b49a4a1d56892692af21a5d38542f8b0deb0e42ade6485186a0dc6ba", "success")}</td></tr>
          <tr><td>Resolver fee paid from a dispute, not from a release</td><td>Previous escrow {address("0x7b31489D0da4b745E26689647FC1514071De3fD4")}</td><td>{tx("0x998c48d1c916b9eed979a6c4d10848d67427c4a5a50c058124c5709fffd6c31d", "success")}</td></tr>
        </tbody>
      </table>
    </section>,
    <section key="mezo" className={styles.slide}>
      <div className={styles.kicker}><span>07 · Mezo around the deal</span><span>These do not spend the escrow</span></div>
      <h2 className={`${styles.display} ${styles.h2}`} style={{ fontSize: 60 }}>Borrow, swap, and park a payout. The escrow balance stays put.</h2>
      <div className={styles.grid}>
        <article className={styles.card}><p className={styles.num}>BORROW</p><h3>A trove, before funding</h3><p>Checkout can open or adjust a trove through BorrowerOperations. A new trove meets Mezo’s minimum debt. The button stays off below a 150% collateral ratio, or when the BTC price is stale.</p></article>
        <article className={styles.card}><p className={styles.num}>SWAP</p><h3>BTC to MUSD in checkout</h3><p>A quote from the testnet basic pool, with a non-zero minimum output. The MUSD lands in the wallet. Funding is still a separate step.</p></article>
        <article className={styles.card}><p className={styles.num}>RESERVE</p><h3>Stability Pool after payout</h3><p>The seller can deposit the MUSD they already hold, and withdraw their own compounded deposit. A liquidation can reduce it. That is not a quoted yield.</p></article>
        <article className={styles.card}><p className={styles.num}>EARN</p><h3>LP and gauge, read only</h3><p>The receipt shows the MUSD/BTC LP balance and the gauge stake. No APR. The savings vault was not found on testnet, so there is no vault deposit.</p></article>
      </div>
    </section>,
    <section key="access" className={styles.slide}>
      <div className={styles.kicker}><span>08 · Who can act</span><span>Wallets, agents, machines</span></div>
      <h2 className={`${styles.display} ${styles.h2}`} style={{ fontSize: 58 }}>The buyer stays the buyer. An agent gets a cap, not the deal.</h2>
      <div className={styles.grid}>
        <article className={styles.card}><p className={styles.num}>WALLETS</p><h3>Browser, Unisat, Xverse, OKX</h3><p>Bitcoin wallets appear when that extension exposes an Ethereum provider. The app stays on its current wallet stack. A Bitcoin-only extension cannot send the Mezo transaction.</p></article>
        <article className={styles.card}><p className={styles.num}>FUNDING AGENT</p><h3>A remaining MUSD cap</h3><p>The agent funds agreements that already name the buyer. The agent cannot release, refund, or dispute. Open invoices have no stored buyer, so an agent cannot fund them.</p></article>
        <article className={styles.card}><p className={styles.num}>DELIVERY AGENT</p><h3>Evidence only</h3><p>The seller can allow another address to submit the delivery note. That address cannot settle the agreement.</p></article>
        <article className={styles.card}><p className={styles.num}>TWO 402s</p><h3>Do not mix them</h3><p>The agreement route returns approve and fund instructions for that invoice. The official exact-scheme payment pays a merchant. It does not fund the escrow.</p></article>
      </div>
    </section>,
    <section key="proof" className={styles.slide}>
      <div className={styles.kicker}><span>09 · On this deployment</span><span>Chain 31611</span></div>
      <h2 className={`${styles.display} ${styles.h2}`} style={{ fontSize: 56 }}>New checkouts use one contract. Older agreements stay where they were created.</h2>
      <table className={styles.proof}>
        <thead><tr><th>Piece</th><th>Address</th><th>What the app uses it for</th></tr></thead>
        <tbody>
          <tr><td>Current escrow</td><td>{address("0x069eef42fb0BaffFfFdCd7755e6e21E37299365d")}</td><td>New agreements. Permit2 funding. Sourcify exact match.</td></tr>
          <tr><td>MUSD</td><td>{address("0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503")}</td><td>The only payment token. 18 decimals.</td></tr>
          <tr><td>Permit2</td><td>{address("0x000000000022D473030F116dDEE9F6B43aC78BA3")}</td><td>The signature used by Sign and fund.</td></tr>
          <tr><td>BorrowerOperations</td><td>{address("0xCdF7028ceAB81fA0C6971208e83fa7872994beE5")}</td><td>Open, adjust, or withdraw MUSD before funding.</td></tr>
          <tr><td>MUSD/BTC pool</td><td>{address("0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9")}</td><td>The in-checkout swap, and the Earn LP read.</td></tr>
          <tr><td>Stability Pool</td><td>{address("0x1CCA7E410eE41739792eA0A24e00349Dd247680e")}</td><td>A seller deposit of their own payout. {tx("0x3413d5a9f8af88726573888b29e8bfefd1ebb0304caa91a9cda76715c4d10443", "A withdrawal")}</td></tr>
        </tbody>
      </table>
      <p className={styles.callout}>Six earlier escrows stay readable. An id on an old contract is not the same agreement as that id on the current one. The checkout link carries the contract address when it is not the current deployment.</p>
    </section>,
    <section key="close" className={styles.slide}>
      <div className={styles.kicker}><span>10 · What this is, and what it is not</span><span>Testnet</span></div>
      <div className={styles.cols}>
        <div>
          <h2 className={`${styles.display} ${styles.h2}`}>A checkout for people who already have a deal.</h2>
          <div className={styles.list}>
            <p className={styles.listItem}><span className={styles.num}>FOR</span><span>Sellers who want MUSD locked to a deadline, and buyers who want to read the terms before funding.</span></p>
            <p className={styles.listItem}><span className={styles.num}>FOR</span><span>A capped agent that pays invoices the buyer already named, and a machine that settles the same fund transaction.</span></p>
            <p className={styles.listItem}><span className={styles.num}>NOT</span><span>A custodian, a court, or a yield product. Mainnet stays off. The contract has not been independently audited.</span></p>
          </div>
        </div>
        <div>
          <article className={styles.card}><h3>While the page is open</h3><p>Activity listens on the Mezo websocket. If it drops, the saved index remains. The host catches up once a day, because a Hobby schedule cannot run faster.</p></article>
          <article className={styles.card} style={{ marginTop: 16 }}><h3>Deploy</h3><p>This escrow was deployed in {tx("0x9f34b437e64c3212122d840680d25711545db174a12d1d1a8ad897db88f00097", "0x9f34…0097")}. Source match is on Sourcify. The Blockscout API did not return a verification record.</p></article>
          <div className={styles.chips}>
            <Link className={styles.chip} href="/dashboard">Open the app</Link>
            <Link className={styles.chip} href="/docs">Read the rules</Link>
            <a className={styles.chip} href="https://repo.sourcify.dev/contracts/full_match/31611/0x069eef42fb0BaffFfFdCd7755e6e21E37299365d/" target="_blank" rel="noreferrer">Sourcify match</a>
          </div>
        </div>
      </div>
    </section>,
  ];

  return (
    <div
      className={styles.root}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) return;
        go(event.clientX < window.innerWidth * 0.28 ? index - 1 : index + 1);
      }}
    >
      <div className={styles.stage} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {slides.map((slide, slideIndex) => (
          <div key={slide.key} className={slideIndex === index ? `${styles.frame} ${styles.frameOn}` : styles.frame} aria-hidden={slideIndex !== index}>
            {slide}
          </div>
        ))}
        {index === 0 ? <p className={styles.hint}>Arrow keys or click</p> : null}
      </div>
      <div className={styles.footer}>
        <Link className={styles.back} href="/">RELAY</Link>
        <button type="button" className={styles.navBtn} onClick={() => go(index - 1)} disabled={index === 0}>Back</button>
        <div className={styles.bar} aria-hidden><span style={{ width: `${((index + 1) / SLIDE_COUNT) * 100}%` }} /></div>
        <span className={styles.count}>{String(index + 1).padStart(2, "0")} / {String(SLIDE_COUNT).padStart(2, "0")}</span>
        <button type="button" className={styles.navBtn} onClick={() => go(index + 1)} disabled={index === SLIDE_COUNT - 1}>Next</button>
      </div>
    </div>
  );
}
