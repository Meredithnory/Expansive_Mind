import { redirect } from "next/navigation";
import { PAYMENTS_VISIBLE } from "../lib/payments";

/** While paid plans are hidden, old Pricing links land on the home page. */
export default function PricingLayout({ children }: { children: React.ReactNode }) {
    if (!PAYMENTS_VISIBLE) redirect("/");
    return children;
}
