import { getReleaseStatus } from "./release-service";

document.documentElement.classList.add("js");

const query = <T extends Element>(selector: string) => document.querySelector<T>(selector);
const queryAll = <T extends Element>(selector: string) => [...document.querySelectorAll<T>(selector)];

function setupNavigation() {
  const toggle = query<HTMLButtonElement>(".menu-toggle");
  const nav = query<HTMLElement>("#site-nav");
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

  queryAll<HTMLAnchorElement>("#site-nav a").forEach((link) => link.addEventListener("click", close));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !nav.hasAttribute("data-open")) return;
    close();
    toggle.focus();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 880) close();
  });
}

function setupActiveNavigation() {
  const links = queryAll<HTMLAnchorElement>("#site-nav a[href^='#']");
  const destinations = links.flatMap((link) => {
    const selector = link.getAttribute("href");
    const section = selector ? query<HTMLElement>(selector) : null;
    return section ? [{ link, section }] : [];
  });
  let animationFrame: number | null = null;

  const update = () => {
    animationFrame = null;
    const marker = Math.min(window.innerHeight * 0.35, 240);
    const active = destinations.reduce<HTMLAnchorElement | null>((current, destination) => {
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
  const items = queryAll<HTMLElement>(".reveal");
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
  queryAll<HTMLDetailsElement>(".faq-list details").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      queryAll<HTMLDetailsElement>(".faq-list details").forEach((peer) => {
        if (peer !== item) peer.open = false;
      });
    });
  });
}

function setBrowserStatus() {
  const status = query<HTMLElement>("#browser-status");
  if (!status) return;
  const supported = "serial" in navigator;
  status.textContent = supported ? "浏览器支持 Web Serial" : "当前浏览器不支持 Web Serial";
  status.toggleAttribute("data-supported", supported);
}

async function setReleaseStatus() {
  const status = query<HTMLElement>("#release-status");
  if (!status) return;

  try {
    const release = await getReleaseStatus();
    status.textContent = release.state === "pending" ? "固件加紧开发中" : `固件 ${release.version} 已就绪`;
    status.closest(".flash-status-line")?.toggleAttribute("data-ready", release.state === "available");
  } catch {
    status.textContent = "暂时无法读取固件状态";
  }
}

const year = query<HTMLElement>("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());
setupNavigation();
setupActiveNavigation();
setupReveals();
setupFaq();
setBrowserStatus();
void setReleaseStatus();
