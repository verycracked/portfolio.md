import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { PortfolioClient } from "../client.js";
import { toolError, toolResult } from "./shared.js";

// Lightweight MIME sniffing for the common image/video extensions our
// /api/upload route accepts. We could pull in `mime-types` but that's another
// 30 KB of dependency for ~10 entries.
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
};

function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export function assetTools(client: PortfolioClient) {
  return {
    async uploadAsset(input: {
      path?: string;
      url?: string;
      filename?: string;
      projectSlug?: string;
      projectName?: string;
    }) {
      try {
        let bytes: Uint8Array;
        let chosenName: string;
        let mime: string;

        if (input.path) {
          const buf = await readFile(input.path);
          bytes = new Uint8Array(buf);
          chosenName = input.filename ?? basename(input.path);
          mime = guessMime(chosenName);
        } else if (input.url) {
          const res = await fetch(input.url);
          if (!res.ok) {
            throw new Error(
              `failed to fetch ${input.url}: ${res.status} ${res.statusText}`
            );
          }
          const arr = new Uint8Array(await res.arrayBuffer());
          bytes = arr;
          const urlBasename = input.url.split("/").pop()?.split("?")[0] ?? "asset";
          chosenName = input.filename ?? urlBasename;
          mime =
            res.headers.get("content-type")?.split(";")[0]?.trim() ??
            guessMime(chosenName);
        } else {
          throw new Error("either path or url must be provided");
        }

        const uploaded = await client.uploadFile({
          filename: chosenName,
          mime,
          data: bytes,
          projectSlug: input.projectSlug,
          projectName: input.projectName,
        });
        return toolResult(uploaded);
      } catch (err) {
        return toolError(err);
      }
    },
  };
}
