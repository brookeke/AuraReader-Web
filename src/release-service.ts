export type ReleaseStatus =
  | { state: "pending" }
  | { state: "available"; version: string; publishedAt: string };

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const manifestUrl = import.meta.env.VITE_RELEASE_MANIFEST_URL?.trim();

export async function getReleaseStatus(): Promise<ReleaseStatus> {
  const endpoint = apiBaseUrl
    ? `${apiBaseUrl.replace(/\/$/, "")}/v1/releases/latest`
    : manifestUrl;

  if (!endpoint) return { state: "pending" };

  const response = await fetch(endpoint, {
    cache: "no-cache",
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Release status request failed: ${response.status}`);

  return parseReleaseStatus(await response.json());
}

function parseReleaseStatus(value: unknown): ReleaseStatus {
  if (!value || typeof value !== "object" || !("state" in value)) {
    throw new Error("Release status response is invalid");
  }

  if (value.state === "pending") return { state: "pending" };

  if (
    value.state === "available" &&
    "version" in value &&
    typeof value.version === "string" &&
    value.version.length > 0 &&
    "publishedAt" in value &&
    typeof value.publishedAt === "string" &&
    !Number.isNaN(Date.parse(value.publishedAt))
  ) {
    return { state: "available", version: value.version, publishedAt: value.publishedAt };
  }

  throw new Error("Release status response is invalid");
}

