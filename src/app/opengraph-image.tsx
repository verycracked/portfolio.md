import { ImageResponse } from "next/og";

/**
 * Link-preview image: solid amber field with the VC mark centered in
 * black. No text, no glow — the simplest possible chip so it reads
 * instantly at any preview size (Slack, iMessage, Twitter, etc.).
 */

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "V.C. Billingsley";

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
          justifyContent: "center",
          background: "#FF9B00",
        }}
      >
        <svg
          width="360"
          height="360"
          viewBox="0 0 1149 1148"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={VC_LOGO} fill="#000000" />
        </svg>
      </div>
    ),
    size
  );
}
