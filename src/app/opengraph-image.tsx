import { ImageResponse } from "next/og";

/**
 * Auto-generated OpenGraph image for the homepage (and every page that
 * doesn't override it). Renders a 1200×630 PNG matching the site's stone
 * palette — VC mark on the left, name + tagline on the right.
 *
 * Next.js calls this route at build/request time; the returned ImageResponse
 * is cached by Vercel's edge.
 */

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "V.C. Billingsley — Design & Code";

// VC mark path — same one used as the site favicon. Inlined so the OG
// generator doesn't need a network fetch at render time.
const VC_LOGO =
  "M1148.11 611.629L769.614 713.047L1148.11 814.466V1147.97L769.614 1046.55L391.114 945.129V758H668.035L668.135 757.63L769.427 379.597L769.614 379.547L1148.11 278.129V611.629ZM334.635 0.370117L435.569 377.068L536.506 0.370117L536.605 0L871.141 0L870.972 0.629883L769.553 379.13L769.427 379.597L391.114 480.965L391.114 758H203.104L203.005 757.63L101.587 379.13L0.167969 0.629883L0 0L334.535 0L334.635 0.370117Z";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#0c0a09", // stone-950 — matches the site `--bg`
          fontFamily: "Geist, sans-serif",
          color: "#fafaf9",
          padding: "80px",
          gap: "72px",
          position: "relative",
        }}
      >
        {/* Soft warm glow behind the mark — gives the image depth without
            the matte-flat feel of a plain dark BG. */}
        <div
          style={{
            position: "absolute",
            top: "120px",
            left: "60px",
            width: "560px",
            height: "560px",
            background:
              "radial-gradient(circle at center, rgba(255,155,0,0.22), rgba(255,155,0,0) 70%)",
            display: "flex",
          }}
        />

        {/* VC mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "300px",
            height: "300px",
            flexShrink: 0,
          }}
        >
          <svg
            width="260"
            height="260"
            viewBox="0 0 1149 1148"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={VC_LOGO} fill="#FF9B00" />
          </svg>
        </div>

        {/* Text block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: "84px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: "#fafaf9",
              display: "flex",
            }}
          >
            V.C. Billingsley
          </div>
          <div
            style={{
              fontSize: "40px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "#a8a29e", // stone-400 — matches `--muted`
              display: "flex",
            }}
          >
            Design & Code, San Francisco
          </div>
          <div
            style={{
              marginTop: "32px",
              fontSize: "22px",
              fontWeight: 500,
              color: "#FF9B00",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            vc-billingsley.com
          </div>
        </div>
      </div>
    ),
    size
  );
}
