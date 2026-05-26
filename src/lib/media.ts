// Shared helpers for media (images vs. videos) stored in R2.
// Keep this tiny — these helpers are used on both server and client.

/** File picker `accept` value used by all upload inputs. */
export const MEDIA_ACCEPT = "image/*,video/mp4,video/webm";

/** Returns true if the given URL points to a video Asset we host. */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm)(\?|#|$)/i.test(url);
}
