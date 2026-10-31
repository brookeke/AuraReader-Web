const environment = import.meta.env ?? {};
const apiBaseUrl = environment.VITE_API_BASE_URL?.trim();
const manifestUrl = environment.VITE_RELEASE_MANIFEST_URL?.trim() || "./firmware/manifest.json";

function normalizeRelease(value) {
  const codename = typeof value?.codename === "string" ? value.codename.trim() : "";
  const version = typeof value?.version === "string" ? value.version.trim() : "";
  const firmwareVersion = typeof value?.firmwareVersion === "string" ? value.firmwareVersion.trim() : "";
  const channel = typeof value?.channel === "string" && value.channel.trim()
    ? value.channel.trim()
    : "stable";
  const displayName = typeof value?.displayName === "string" ? value.displayName.trim() : "";
  const description = typeof value?.description === "string" ? value.description.trim() : "";
  const badge = typeof value?.badge === "string" ? value.badge.trim() : "";
  const sha256 = typeof value?.sha256 === "string" ? value.sha256.trim().toLowerCase() : "";
  const size = Number(value?.size);
  if (
    !value ||
    typeof value !== "object" ||
    value.installable === false ||
    !codename ||
    !version ||
    !firmwareVersion ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    !/^[a-f0-9]{64}$/.test(sha256)
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
    codename,
    version,
    firmwareVersion,
    label: displayName || `${codename} v${version}${channel === "stable" ? "" : ` ${channel}`}`,
    description: description || "严格 16 MiB 完整固件",
    badge,
    publishedAt:
      typeof value.publishedAt === "string" && !Number.isNaN(Date.parse(value.publishedAt))
        ? value.publishedAt
        : null,
    channel,
    chipFamily: build?.chipFamily || value.chipFamily || "ESP32-S3",
    path,
    size,
    sha256,
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
  const valid = candidates.map(normalizeRelease).filter(Boolean);
  const releases = [
    ...valid.filter((release) => release.codename !== "official-demo").slice(0, 3),
    ...valid.filter((release) => release.codename === "official-demo").slice(0, 1),
  ];
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
