const environment = import.meta.env ?? {};
const apiBaseUrl = environment.VITE_API_BASE_URL?.trim();
const manifestUrl = environment.VITE_RELEASE_MANIFEST_URL?.trim() || "./firmware/manifest.json";

function normalizeRelease(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.installable === false ||
    typeof value.codename !== "string" ||
    !value.codename.trim() ||
    typeof value.version !== "string" ||
    !value.version
  ) {
    return null;
  }

  const build = Array.isArray(value.builds)
    ? value.builds.find((item) => item?.chipFamily === "ESP32-S3") ?? value.builds[0]
    : null;
  const part = Array.isArray(build?.parts)
    ? build.parts.find((item) => Number(item?.offset) === 0) ?? build.parts[0]
    : null;
  const path = value.path || value.downloadUrl || (part?.path ? `./firmware/${part.path}` : "");
  if (!path) return null;

  return {
    codename: value.codename.trim(),
    version: value.version,
    publishedAt:
      typeof value.publishedAt === "string" && !Number.isNaN(Date.parse(value.publishedAt))
        ? value.publishedAt
        : null,
    channel: typeof value.channel === "string" ? value.channel : "stable",
    chipFamily: build?.chipFamily || value.chipFamily || "ESP32-S3",
    path,
  };
}

export function parseReleaseCatalog(value) {
  return parseReleaseAvailability(value).releases;
}

export function parseReleaseAvailability(value) {
  if (!value || typeof value !== "object") throw new Error("Release catalog response is invalid");
  if (value.state === "pending") {
    return { state: "pending", codename: null, version: null, releases: [] };
  }
  if (value.state === "suspended" || value.installable === false) {
    return {
      state: "suspended",
      codename: typeof value.codename === "string" && value.codename.trim() ? value.codename.trim() : null,
      version: typeof value.version === "string" ? value.version : null,
      releases: [],
    };
  }

  const candidates = Array.isArray(value.releases) ? value.releases : [value];
  const releases = candidates.map(normalizeRelease).filter(Boolean).slice(0, 2);
  if (releases.length === 0) throw new Error("Release catalog response is invalid");
  return {
    state: "available",
    codename: releases[0].codename,
    version: releases[0].version,
    releases,
  };
}

async function requestReleaseAvailability() {
  const endpoint = apiBaseUrl
    ? `${apiBaseUrl.replace(/\/$/, "")}/v1/releases/latest`
    : manifestUrl;
  const response = await fetch(endpoint, {
    cache: "no-cache",
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Release catalog request failed: ${response.status}`);
  return parseReleaseAvailability(await response.json());
}

export async function getReleaseAvailability() {
  return requestReleaseAvailability();
}

export async function getReleaseCatalog() {
  return (await requestReleaseAvailability()).releases;
}

export async function getReleaseStatus() {
  const availability = await requestReleaseAvailability();
  if (availability.state !== "available") {
    return { state: availability.state, version: availability.version };
  }
  const [release] = availability.releases;
  return { state: "available", version: release.version, publishedAt: release.publishedAt };
}
