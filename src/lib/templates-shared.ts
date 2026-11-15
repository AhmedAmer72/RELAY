import { getAddress, isAddress, keccak256, stringToBytes } from "viem";

export type SellerTemplate = {
  title: string;
  description: string;
  terms: string;
  amount: string;
  buyerMode: "specific" | "open";
  buyer: string;
  resolver: string;
  reviewPeriod: number;
};

export function canonicalTemplate(input: SellerTemplate) {
  return JSON.stringify({
    title: input.title.trim(),
    description: input.description.trim(),
    terms: input.terms.trim(),
    amount: input.amount.trim(),
    buyerMode: input.buyerMode,
    buyer: input.buyer.trim(),
    resolver: input.resolver.trim(),
    reviewPeriod: input.reviewPeriod,
  });
}

export function templateMessage(seller: string, json: string) {
  return `RELAY template\n${getAddress(seller).toLowerCase()}\n${keccak256(stringToBytes(json))}`;
}

export function validTemplate(input: SellerTemplate) {
  return input.title.trim().length >= 3
    && input.description.trim().length >= 10
    && input.terms.trim().length >= 3
    && (input.buyerMode === "specific" || input.buyerMode === "open")
    && Number.isInteger(input.reviewPeriod)
    && input.reviewPeriod >= 15 * 60
    && input.reviewPeriod <= 30 * 24 * 60 * 60
    && (input.buyerMode === "open" || isAddress(input.buyer))
    && isAddress(input.resolver);
}
