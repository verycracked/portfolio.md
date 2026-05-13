import chromium from "@sparticuz/chromium";
import { chromium as pw, type Browser } from "playwright-core";

const localCandidates = [
  process.env.LOCAL_CHROMIUM_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Arc.app/Contents/MacOS/Arc",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean) as string[];

async function localExecutablePath() {
  const fs = await import("node:fs/promises");
  for (const p of localCandidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // continue
    }
  }
  throw new Error(
    "no local Chrome/Chromium found. set LOCAL_CHROMIUM_PATH or install Chrome."
  );
}

export async function launch(): Promise<Browser> {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_REGION;
  return pw.launch({
    args: isServerless ? chromium.args : ["--no-sandbox"],
    executablePath: isServerless
      ? await chromium.executablePath()
      : await localExecutablePath(),
    headless: true,
  });
}
