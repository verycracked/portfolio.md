/**
 * Thin HTTP wrapper around the portfolio.md API. Lives behind a small
 * interface so tool handlers don't care whether they're invoked from the
 * stdio transport (one client, env-configured) or the in-app HTTP transport
 * (one client per request, header-configured).
 *
 * Auth is always `Authorization: Bearer <token>`. The cookie session belongs
 * to the browser editor and is never used here.
 */
export type ClientConfig = {
  /** Base URL of the portfolio.md deploy. No trailing slash. */
  baseUrl: string;
  /** Bearer token minted via the /settings page. */
  token: string;
  /** Override for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

export type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  body?: string;
  heroImageUrl?: string | null;
  sourceUrl?: string | null;
  isOpenable?: boolean;
  hasAudio?: boolean;
  colSpan?: number;
  rowSpan?: number;
  order?: number;
  groupId?: string | null;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectListItem = Pick<
  Project,
  "id" | "slug" | "title" | "description" | "parentId"
>;

export type Surface = {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  description: string;
  body: string;
  heroImageUrl: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export class PortfolioApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly bodyText: string;
  constructor(status: number, url: string, bodyText: string, message?: string) {
    super(message ?? `${status} ${url}: ${bodyText || "(no body)"}`);
    this.name = "PortfolioApiError";
    this.status = status;
    this.url = url;
    this.bodyText = bodyText;
  }
}

export function createClient(config: ClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("PortfolioApi: baseUrl is required");
  }
  if (!config.token) {
    throw new Error("PortfolioApi: token is required");
  }

  async function request<T>(
    path: string,
    init: RequestInit & { expectJson?: boolean } = {}
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.token}`);
    // Don't override Content-Type when the caller is doing multipart upload —
    // the runtime needs to set the boundary itself.
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const res = await fetchImpl(url, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Try to surface the server's `error` field if it's JSON, otherwise
      // pass the raw body up. The MCP layer formats this for the agent.
      let friendly = text;
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error) friendly = parsed.error;
      } catch {
        // not JSON; keep raw
      }
      throw new PortfolioApiError(res.status, url, text, friendly);
    }
    if (init.expectJson === false) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  return {
    // --- projects ---
    listProjects(): Promise<ProjectListItem[]> {
      return request<ProjectListItem[]>("/api/projects");
    },
    getProject(id: string): Promise<Project> {
      return request<Project>(`/api/projects/${encodeURIComponent(id)}`);
    },
    getProjectBySlug(slug: string): Promise<{
      id: string;
      slug: string;
      title: string;
      name: string;
    }> {
      return request(`/api/project/${encodeURIComponent(slug)}`);
    },
    createProject(input: {
      title: string;
      description?: string;
      sourceUrl?: string;
      heroImageUrl?: string;
      groupId?: string;
      parentId?: string;
      isOpenable?: boolean;
    }): Promise<Project> {
      return request<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    updateProject(
      id: string,
      patch: Partial<{
        title: string;
        slug: string;
        description: string;
        body: string;
        heroImageUrl: string | null;
        sourceUrl: string | null;
        order: number;
        colSpan: number;
        rowSpan: number;
        groupId: string;
        parentId: string | null;
        hasAudio: boolean;
        isOpenable: boolean;
        heroOffsetY: number;
      }>
    ): Promise<Project> {
      return request<Project>(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    },

    // --- surfaces ---
    listSurfaces(projectId: string): Promise<Surface[]> {
      return request<Surface[]>(
        `/api/projects/${encodeURIComponent(projectId)}/surfaces`
      );
    },
    createSurface(
      projectId: string,
      input: { name: string; slug?: string }
    ): Promise<Surface> {
      return request<Surface>(
        `/api/projects/${encodeURIComponent(projectId)}/surfaces`,
        { method: "POST", body: JSON.stringify(input) }
      );
    },
    updateSurface(
      projectId: string,
      surfaceId: string,
      patch: Partial<{
        name: string;
        slug: string;
        description: string;
        body: string;
        heroImageUrl: string | null;
        order: number;
      }>
    ): Promise<Surface> {
      return request<Surface>(
        `/api/projects/${encodeURIComponent(projectId)}/surfaces/${encodeURIComponent(surfaceId)}`,
        { method: "PUT", body: JSON.stringify(patch) }
      );
    },

    // --- pages ---
    updatePage(slug: string, body: string): Promise<{ body: string; updatedAt: string }> {
      return request(`/api/pages/${encodeURIComponent(slug)}`, {
        method: "PUT",
        body: JSON.stringify({ body }),
      });
    },

    // --- assets ---
    /**
     * Upload a file by streaming from disk. Used by the stdio MCP where the
     * agent has a local path. We re-export the multipart form from the
     * existing /api/upload contract — same field names as the editor and the
     * Snapshot extension.
     */
    async uploadFile(input: {
      filename: string;
      mime: string;
      data: Uint8Array | Blob;
      projectSlug?: string;
      projectName?: string;
    }): Promise<{ url: string; project: string | null }> {
      const form = new FormData();
      const blob =
        input.data instanceof Blob
          ? input.data
          : new Blob([new Uint8Array(input.data)], { type: input.mime });
      form.append("file", blob, input.filename);
      if (input.projectSlug) form.append("project", input.projectSlug);
      if (input.projectName) form.append("projectName", input.projectName);
      return request("/api/upload", { method: "POST", body: form });
    },
  };
}

export type PortfolioClient = ReturnType<typeof createClient>;
