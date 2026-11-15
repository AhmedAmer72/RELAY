import { X402_FACILITATOR, X402_NETWORK, X402_PRICE, X402_SCHEME } from "@/lib/x402/instant";

export default function InstantPaymentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Mezo x402</p>
      <h1 className="display-title">Instant MUSD payment</h1>
      <p className="text-muted">This page is the official exact-scheme payment. It uses {X402_SCHEME} on {X402_NETWORK} and the facilitator at {X402_FACILITATOR}. The price is {X402_PRICE}. The recipient is the configured merchant, not RelayEscrow.</p>
      <p className="text-muted">A direct MUSD transfer does not fund an agreement. Protected checkout stays on the agreement page, which asks for approve and fundEscrow.</p>
      <p><a className="font-semibold text-brand" href="/api/x402/instant">Open the payment request</a></p>
    </div>
  );
}
