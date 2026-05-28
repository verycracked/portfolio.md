"use client";

/**
 * Pull a still from a video file's first decodable frame using an
 * offscreen <video> + canvas. Returns a JPEG File that can be uploaded
 * via /api/upload as the poster for the video. Resolves to null if the
 * browser refuses to seek / decode (e.g. unsupported codec).
 *
 * Used by both the initial upload flow (`<NewTile>`) and the
 * replace-cover flow on existing tiles, so we don't drift between two
 * copies of this trick.
 */
export async function extractVideoPoster(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    let seeked = false;
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
      } catch {
        cleanup();
        resolve(null);
      }
    };
    video.onseeked = () => {
      if (seeked) return;
      seeked = true;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        resolve(null);
        return;
      }
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch {
        cleanup();
        resolve(null);
        return;
      }
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (!blob) return resolve(null);
          const base = file.name.replace(/\.[^.]+$/, "");
          resolve(
            new File([blob], `${base}.poster.jpg`, { type: "image/jpeg" })
          );
        },
        "image/jpeg",
        0.85
      );
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
  });
}

/**
 * Upload a single media file (image or video). For videos, also extracts
 * a poster client-side and uploads it as a separate asset. Returns both
 * URLs (poster is null for images).
 */
export async function uploadMedia(
  file: File
): Promise<{ url: string; posterUrl: string | null } | null> {
  let posterUrl: string | null = null;
  if (file.type.startsWith("video/")) {
    const poster = await extractVideoPoster(file).catch(() => null);
    if (poster) {
      const posterFd = new FormData();
      posterFd.append("file", poster);
      const posterRes = await fetch("/api/upload", {
        method: "POST",
        body: posterFd,
      });
      if (posterRes.ok) {
        const data = (await posterRes.json()) as { url: string };
        posterUrl = data.url;
      }
    }
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const data = (await res.json()) as { url: string };
  return { url: data.url, posterUrl };
}
