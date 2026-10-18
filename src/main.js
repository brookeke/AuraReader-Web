import { getReleaseAvailability } from "./release-service.js";
import { getHeaderVisibility } from "./header-visibility.js";
import { setupWebFlasher } from "./web-flasher.js";

document.documentElement.classList.add("js");

const query = (selector) => document.querySelector(selector);
const queryAll = (selector) => [...document.querySelectorAll(selector)];

function setupNavigation() {
  const toggle = query(".menu-toggle");
  const nav = query("#site-nav");
  if (!toggle || !nav) return;

  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    nav.removeAttribute("data-open");
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    nav.toggleAttribute("data-open", !isOpen);
  });

  queryAll("#site-nav a").forEach((link) => link.addEventListener("click", close));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !nav.hasAttribute("data-open")) return;
    close();
    toggle.focus();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 880) close();
  });
}

function setupAutoHideHeader() {
  const header = query("[data-auto-hide-header]");
  const revealZone = query("[data-header-reveal-zone]");
  const nav = query("#site-nav");
  if (!header) return;

  let previousScrollY = Math.max(window.scrollY, 0);
  let animationFrame = null;

  const show = () => header.removeAttribute("data-hidden");
  const update = () => {
    animationFrame = null;
    const currentScrollY = Math.max(window.scrollY, 0);
    const visibility = getHeaderVisibility({
      currentScrollY,
      previousScrollY,
      headerHeight: header.offsetHeight,
      locked: nav?.hasAttribute("data-open") || header.matches(":focus-within"),
    });

    if (visibility === "hidden") header.setAttribute("data-hidden", "");
    if (visibility === "visible") show();
    previousScrollY = currentScrollY;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (animationFrame !== null) return;
      animationFrame = requestAnimationFrame(update);
    },
    { passive: true },
  );
  header.addEventListener("pointerenter", show);
  header.addEventListener("focusin", show);
  revealZone?.addEventListener("pointerenter", show);
  window.addEventListener("hashchange", show);
}

function setupActiveNavigation() {
  const links = queryAll("#site-nav a[href^='#']");
  const destinations = links.flatMap((link) => {
    const selector = link.getAttribute("href");
    const section = selector ? query(selector) : null;
    return section ? [{ link, section }] : [];
  });
  let animationFrame = null;

  const update = () => {
    animationFrame = null;
    const marker = Math.min(window.innerHeight * 0.35, 240);
    const active = destinations.reduce((current, destination) => {
      return destination.section.getBoundingClientRect().top <= marker ? destination.link : current;
    }, null);

    links.forEach((link) => {
      if (link === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  const scheduleUpdate = () => {
    if (animationFrame !== null) return;
    animationFrame = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", scheduleUpdate);
  update();
}

function setupReveals() {
  const items = queryAll(".reveal");
  queryAll("[data-reveal-group]").forEach((group) => {
    [...group.children]
      .filter((item) => item.classList.contains("reveal"))
      .forEach((item, index) => {
        item.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 90}ms`);
      });
  });

  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.setAttribute("data-visible", ""));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute("data-visible", "");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );

  items.forEach((item) => observer.observe(item));
}

function setupFaq() {
  queryAll(".faq-list details").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      queryAll(".faq-list details").forEach((peer) => {
        if (peer !== item) peer.open = false;
      });
    });
  });
}

async function loadReleaseCatalog(onReleases) {
  const status = query("#release-status");
  const releaseCodename = query("#flash-release-codename");
  const releaseVersion = query("#flash-release-version");
  const releaseChannel = query("#flash-release-channel");
  if (!status) return;

  try {
    const availability = await getReleaseAvailability();
    const ready = availability.state === "available";
    if (availability.state === "suspended") {
      if (availability.codename && releaseCodename) releaseCodename.textContent = availability.codename;
      if (availability.version && releaseVersion) releaseVersion.textContent = `v${availability.version}`;
      if (releaseChannel) releaseChannel.hidden = true;
      status.textContent = availability.version
        ? `固件 v${availability.version} 烧录已暂停`
        : "固件烧录已暂停";
    } else {
      const [release] = availability.releases;
      if (release) {
        if (releaseCodename) releaseCodename.textContent = release.codename;
        if (releaseVersion) releaseVersion.textContent = `v${release.version}`;
        if (releaseChannel) {
          releaseChannel.textContent = release.channel;
          releaseChannel.hidden = release.channel === "stable";
        }
      }
      status.textContent = ready ? `固件 ${release.label} 已就绪` : "固件暂未发布";
    }
    status.closest(".flash-status-line")?.toggleAttribute("data-ready", ready);
    onReleases(availability.releases);
  } catch {
    status.textContent = "暂时无法读取固件状态";
    onReleases([]);
  }
}

const year = query("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());
setupNavigation();
setupAutoHideHeader();
setupActiveNavigation();
setupReveals();
setupFaq();
const flasher = setupWebFlasher();
void loadReleaseCatalog(flasher.setReleases);
