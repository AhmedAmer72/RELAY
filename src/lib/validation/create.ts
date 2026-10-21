import { isAddress } from "viem";
import {
  MAX_HORIZON,
  MAX_METADATA_BYTES,
  MAX_REVIEW_PERIOD,
  MIN_DELIVERY_GAP,
  MIN_REVIEW_PERIOD,
} from "@/lib/escrow/constants";
import { sameAddress } from "@/lib/escrow/format";
import { buildMetadata, utf8Size } from "@/lib/metadata/canonical";
import { parseMusdInput } from "@/lib/escrow/format";

export type CreateDraft = {
  title: string;
  description: string;
  terms: string;
  amount: string;
  buyerMode: "specific" | "open";
  buyer: string;
  resolver: string;
  fundingDeadline: number | undefined;
  deliveryDeadline: number | undefined;
  reviewPeriod: number;
  acknowledged: boolean;
  milestones?: MilestoneDraft[];
};

export type MilestoneDraft = {
  label: string;
  amount: string;
  deliveryDeadline: number | undefined;
  reviewPeriod: number;
};

export function validateCreateDraft(draft: CreateDraft, seller?: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const errors: Record<string, string> = {};
  if (draft.title.trim().length < 3 || draft.title.trim().length > 80) errors.title = "Use a title between 3 and 80 characters.";
  if (draft.description.trim().length < 10 || draft.description.trim().length > 600) {
    errors.description = "Describe the delivery in 10 to 600 characters.";
  }
  if (draft.terms.trim().length < 10 || draft.terms.trim().length > 1000) {
    errors.terms = "Write the acceptance terms in 10 to 1000 characters.";
  }
  const parsed = parseMusdInput(draft.amount);
  if (!parsed.ok) errors.amount = parsed.error;

  let buyer = "0x0000000000000000000000000000000000000000";
  if (draft.buyerMode === "specific") {
    if (!isAddress(draft.buyer)) errors.buyer = "Enter the buyer wallet address.";
    else if (seller && sameAddress(draft.buyer, seller)) errors.buyer = "The buyer must be a different wallet from the seller.";
    else buyer = draft.buyer;
  }

  if (!isAddress(draft.resolver)) errors.resolver = "Enter the dispute resolver address.";
  else if (seller && sameAddress(draft.resolver, seller)) errors.resolver = "The resolver cannot be the seller.";
  else if (draft.buyerMode === "specific" && isAddress(draft.buyer) && sameAddress(draft.resolver, draft.buyer)) {
    errors.resolver = "The resolver cannot be the buyer.";
  }

  if (!draft.fundingDeadline || !draft.deliveryDeadline) {
    errors.fundingDeadline = "Choose a funding deadline and a delivery deadline.";
  } else {
    if (draft.fundingDeadline <= nowSeconds + 5 * 60) errors.fundingDeadline = "Leave at least 5 minutes before the funding deadline so the transaction can be mined.";
    if (draft.deliveryDeadline < draft.fundingDeadline + MIN_DELIVERY_GAP) {
      errors.deliveryDeadline = "The delivery deadline must be at least 1 hour after the funding deadline.";
    }
    if (draft.fundingDeadline > nowSeconds + MAX_HORIZON || draft.deliveryDeadline > nowSeconds + MAX_HORIZON) {
      errors.deliveryDeadline = "Deadlines must be within 365 days.";
    }
  }

  if (draft.reviewPeriod < MIN_REVIEW_PERIOD || draft.reviewPeriod > MAX_REVIEW_PERIOD) {
    errors.reviewPeriod = "Choose a review window between 15 minutes and 30 days.";
  }
  if (!draft.acknowledged) errors.acknowledged = "Confirm that you have reviewed the resolver and the review-window rule.";

  let metadataBytes = 0;
  if (!errors.title && !errors.description && !errors.terms) {
    metadataBytes = utf8Size(buildMetadata({
      title: draft.title.trim(),
      description: draft.description.trim(),
      terms: draft.terms.trim(),
    }).json);
    if (metadataBytes > MAX_METADATA_BYTES) errors.terms = "The agreement is too long to store on-chain. Shorten the description or terms.";
  }

  return { errors, valid: Object.keys(errors).length === 0, buyer, metadataBytes, amount: parsed.ok ? parsed.amount : undefined };
}

export function validateMilestones(draft: CreateDraft, nowSeconds = Math.floor(Date.now() / 1000)) {
  const rows = draft.milestones ?? [];
  const errors: Record<string, string> = {};
  if (rows.length === 0) return { errors, valid: true };
  if (rows.length < 2 || rows.length > 5) errors.milestones = "Use 2 to 5 milestones, or leave this as a single payment.";
  rows.forEach((row, index) => {
    if (row.label.trim().length < 2 || row.label.trim().length > 40) errors[`label-${index}`] = "Name this milestone in 2 to 40 characters.";
    const amount = parseMusdInput(row.amount);
    if (!amount.ok) errors[`amount-${index}`] = amount.error;
    if (!row.deliveryDeadline || !draft.fundingDeadline || row.deliveryDeadline < draft.fundingDeadline + MIN_DELIVERY_GAP) {
      errors[`delivery-${index}`] = "Each delivery deadline must be at least 1 hour after funding.";
    } else if (row.deliveryDeadline > nowSeconds + MAX_HORIZON) {
      errors[`delivery-${index}`] = "Deadlines must be within 365 days.";
    }
    if (row.reviewPeriod < MIN_REVIEW_PERIOD || row.reviewPeriod > MAX_REVIEW_PERIOD) errors[`review-${index}`] = "Choose a review window between 15 minutes and 30 days.";
    const title = `${draft.title.trim()} — ${row.label.trim()}`;
    if (title.length > 80) errors[`label-${index}`] = "The combined title is longer than 80 characters.";
  });
  return { errors, valid: Object.keys(errors).length === 0 };
}
