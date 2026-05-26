// Network helpers for ProjectForm and its split-out children. These live
// outside the component file so the call sites stay readable and so the
// helpers can be tested or reused without dragging the React tree along.

export type SurfaceImage = {
  id: string;
  url: string;
  caption: string | null;
};

export type SurfacePatch = {
  name?: string;
  slug?: string;
  body?: string;
  heroImageUrl?: string | null;
  order?: number;
};

/** Upload a single file to R2 via /api/upload, optionally scoping it. */
export async function uploadFile(
  file: File,
  projectSlug?: string
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  if (projectSlug) fd.append("project", projectSlug);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload failed");
  const data = (await res.json()) as { url: string };
  return data.url;
}

/** Trigger the screenshot pipeline for a URL and return the captured image URL. */
export async function captureUrl(url: string): Promise<string> {
  const res = await fetch("/api/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "capture failed");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

/** PATCH-like project update (we use PUT under the hood; server treats as partial). */
export async function saveProject(
  projectId: string,
  patch: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {
    // silent — keystroke saves shouldn't surface transient errors
  }
}

/** Persist surface fields. Used by SurfaceEditor for hero/body/etc. */
export async function saveSurface(
  projectId: string,
  surfaceId: string,
  patch: SurfacePatch
): Promise<void> {
  try {
    await fetch(`/api/projects/${projectId}/surfaces/${surfaceId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {
    // silent
  }
}

/** Attach an already-uploaded URL to a surface as a gallery image. */
export async function addSurfaceImage(
  projectId: string,
  surfaceId: string,
  url: string
): Promise<SurfaceImage | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/images`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, surfaceId }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SurfaceImage;
  } catch {
    return null;
  }
}

/** Delete a gallery image by id. */
export async function removeSurfaceImage(
  projectId: string,
  imageId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/projects/${projectId}/images?imageId=${imageId}`,
      { method: "DELETE" }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Create a new surface; server returns the created record (with empty body/images). */
export async function createSurface(
  projectId: string,
  name: string
): Promise<{ id: string; slug: string; name: string; order: number } | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/surfaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      id: string;
      slug: string;
      name: string;
      order: number;
    };
  } catch {
    return null;
  }
}

/** Delete a surface by id. The server refuses to delete the last remaining one. */
export async function deleteSurface(
  projectId: string,
  surfaceId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/projects/${projectId}/surfaces/${surfaceId}`,
      { method: "DELETE" }
    );
    return res.ok;
  } catch {
    return false;
  }
}
