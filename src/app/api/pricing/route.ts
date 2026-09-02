import { NextResponse } from "next/server";
import { getPlanConfig } from "../../lib/plan-config";

export async function GET() {
    const config = await getPlanConfig();
    return NextResponse.json(
        {
            prices: {
                month: {
                    amount: config.prices.month.amount,
                    currency: config.prices.month.currency,
                },
                year: {
                    amount: config.prices.year.amount,
                    currency: config.prices.year.currency,
                },
            },
            entitlements: config.entitlements,
        },
        { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
}
