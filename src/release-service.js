const environment = import.meta.env ?? {};
const apiBaseUrl = environment.VITE_API_BASE_URL?.trim();
const manifestUrl = environment.VITE_RELEASE_MANIFEST_URL?.trim() || "./firmware/manifest.json";

export async function getReleaseStatus() {
  const endpoint = apiBaseUrl
    ? `${apiBaseUrl.replace(/\/$/, "")}/v1/releases/latest`
    : manifestUrl;

  const response = await fetch(endpoint, {
    cache: "no-cache",
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Release status request failed: ${response.status}`);

  return parseReleaseStatus(await response.json());
}

function parseReleaseStatus(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Release status response is invalid");
  }

  if (value.state === "pending") return { state: "pending" };

  if (
    value.state === "available" &&
    typeof value.version === "string" &&
    value.version.length > 0 &&
    typeof value.publishedAt === "string" &&
    !Number.isNaN(Date.parse(value.publishedAt))
  ) {
    return { state: "available", version: value.version, publishedAt: value.publishedAt };
  }

  if (
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    Array.isArray(value.builds) &&
    value.builds.length > 0
  ) {
    return { state: "available", version: value.version, publishedAt: null };
  }

  throw new Error("Release status response is invalid");
}
