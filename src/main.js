import { getReleaseStatus } from "./release-service.js";
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

async function setReleaseStatus(onReady) {
  const status = query("#release-status");
  if (!status) return;

  try {
    const release = await getReleaseStatus();
    const ready = release.state === "available";
    status.textContent = ready ? `固件 ${release.version} 已就绪` : "固件暂未发布";
    status.closest(".flash-status-line")?.toggleAttribute("data-ready", ready);
    onReady(ready);
  } catch {
    status.textContent = "暂时无法读取固件状态";
    onReady(false);
  }
}

const year = query("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());
setupNavigation();
setupActiveNavigation();
setupReveals();
setupFaq();
const flasher = setupWebFlasher();
void setReleaseStatus(flasher.setReleaseReady);
