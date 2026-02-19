function normalizePath(p) {
  return (p || "").split("?")[0].split("#")[0];
}

function isPlainLeftClick(e) {
  return (
    !e.defaultPrevented &&
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey
  );
}

function scrollToLandingMain() {
  const el = document.querySelector("main.landing-main");
  if (!el) return false;

  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  el.addEventListener(
    "blur",
    () => el.removeAttribute("tabindex"),
    { once: true }
  );
  return true;
}

function maybeAutoScrollGallery() {
  const current = normalizePath(window.location.pathname);
  const currentFile = current.split("/").pop() || "index.html";

  if (currentFile !== "index.html") return;
  if (window.location.hash !== "#gallery") return;


  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (scrollToLandingMain()) return;
      setTimeout(scrollToLandingMain, 250);
      setTimeout(scrollToLandingMain, 700);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  maybeAutoScrollGallery();
  window.addEventListener("hashchange", maybeAutoScrollGallery);

  const links = Array.from(document.querySelectorAll(".top-nav .nav-link"));
  if (links.length) {
    const current = normalizePath(window.location.pathname);
    const currentFile = current.split("/").pop() || "index.html";

    links.forEach((a) => {
      const hrefRaw = a.getAttribute("href") || "";
      const hrefFile = normalizePath(hrefRaw).split("/").pop();

      const isActive =
        (currentFile === "" && hrefFile === "index.html") ||
        currentFile === hrefFile ||
        (currentFile === "detail.html" && hrefFile === "index.html");

      if (isActive) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      } else {
        a.classList.remove("is-active");
        a.removeAttribute("aria-current");
      }

      if (hrefFile === "index.html") {
        a.addEventListener("click", (e) => {
          if (!isPlainLeftClick(e)) return;

          const here = normalizePath(window.location.pathname);
          const hereFile = here.split("/").pop() || "index.html";

          e.preventDefault();
          if (hereFile === "index.html") {
            history.replaceState(null, "", "#gallery");
            scrollToLandingMain();
          } else {
            window.location.href = "index.html#gallery";
          }
        });
      }
    });
  }
});

 window.addEventListener("load", () => {
  if (window.location.hash === "#gallery") maybeAutoScrollGallery();
});
 