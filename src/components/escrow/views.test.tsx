import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionPanel, StatusBadge } from "@/components/escrow/views";
import type { PanelModel } from "@/lib/escrow/types";

describe("escrow views", () => {
  it("labels each contract state in words", () => {
    render(<StatusBadge state="Funded" />);
    expect(screen.getByText("Funds secured")).toBeInTheDocument();
  });

  it("renders only the actions the policy offers", () => {
    const panel: PanelModel = {
      notices: ["A refund is not currently available under this agreement."],
      primary: { id: "release", label: "Approve delivery and release funds", description: "Release copy", tone: "primary" },
      secondary: [{ id: "dispute", label: "Raise a dispute", description: "Dispute copy", tone: "danger" }],
    };
    render(<ActionPanel panel={panel} onAction={() => undefined} />);
    expect(screen.getByRole("button", { name: "Approve delivery and release funds" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Raise a dispute" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /refund/i })).not.toBeInTheDocument();
  });
});
