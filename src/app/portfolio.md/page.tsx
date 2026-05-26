import { redirect } from "next/navigation";

// Legacy redirect — the portfolio gallery now lives inline on `/`, so any
// old `/portfolio.md` link lands on the home page (which scrolls to the
// gallery section via the #portfolio anchor).
export default function PortfolioLegacyRedirect() {
  redirect("/#portfolio");
}
