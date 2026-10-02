/**
 * Whether paid plans show anywhere: the Pricing page and its links, upgrade
 * prompts, "Pro" labels, and checkout. Hidden (Meredith, 2026-10-01) so
 * nothing about paying stands between a researcher and trying the product;
 * free accounts get monthly limits instead. Pro access already granted is
 * untouched. Flip to true to bring paid plans back.
 */
export const PAYMENTS_VISIBLE: boolean = false;

/** "Google Scholar (Pro)" only while paid plans show. */
export const SCHOLAR_SOURCE_LABEL = PAYMENTS_VISIBLE
    ? "Google Scholar (Pro)"
    : "Google Scholar";
