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

function scrollToGallery() {
  const el = document.querySelector("#gallery");
  if (!el) return false;

  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

function maybeAutoScrollGallery() {
  const current = normalizePath(window.location.pathname);
  const currentFile = current.split("/").pop() || "index.html";

  if (currentFile !== "index.html") return;
  if (window.location.hash !== "#gallery") return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (scrollToGallery()) return;
      setTimeout(scrollToGallery, 250);
      setTimeout(scrollToGallery, 700);
    });
  });
}

function updateActiveNav() {
  const links = Array.from(document.querySelectorAll(".top-nav .nav-link"));
  const current = normalizePath(window.location.pathname);
  const currentFile = current.split("/").pop() || "index.html";
  const onGalleryAnchor = currentFile === "index.html" && window.location.hash === "#gallery";

  links.forEach((a) => {
    const hrefRaw = a.getAttribute("href") || "";
    const hrefFile = normalizePath(hrefRaw).split("/").pop();
    const hrefHash = hrefRaw.includes("#") ? `#${hrefRaw.split("#")[1]}` : "";

    let isActive = false;
    if (currentFile === "detail.html") {
      isActive = hrefFile === "index.html" && hrefHash === "#gallery";
    } else if (currentFile === "index.html") {
      isActive = onGalleryAnchor
        ? hrefFile === "index.html" && hrefHash === "#gallery"
        : hrefFile === "index.html" && !hrefHash;
    } else {
      isActive = currentFile === hrefFile;
    }

    a.classList.toggle("is-active", isActive);
    if (isActive) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  maybeAutoScrollGallery();
  updateActiveNav();
  window.addEventListener("hashchange", () => {
    maybeAutoScrollGallery();
    updateActiveNav();
  });

  const links = Array.from(document.querySelectorAll(".top-nav .nav-link"));
  if (links.length) {
    links.forEach((a) => {
      const hrefRaw = a.getAttribute("href") || "";
      const hrefFile = normalizePath(hrefRaw).split("/").pop();
      const hrefHash = hrefRaw.includes("#") ? `#${hrefRaw.split("#")[1]}` : "";

      if (hrefFile === "index.html" && hrefHash === "#gallery") {
        a.addEventListener("click", (e) => {
          if (!isPlainLeftClick(e)) return;

          const here = normalizePath(window.location.pathname);
          const hereFile = here.split("/").pop() || "index.html";

          e.preventDefault();
          if (hereFile === "index.html") {
            history.replaceState(null, "", "#gallery");
            scrollToGallery();
            updateActiveNav();
            if (e.detail > 0) a.blur();
          } else {
            window.location.href = "index.html#gallery";
          }
        });
      }

      if (hrefFile === "index.html" && !hrefHash) {
        a.addEventListener("click", (e) => {
          if (!isPlainLeftClick(e)) return;

          const here = normalizePath(window.location.pathname);
          const hereFile = here.split("/").pop() || "index.html";
          if (hereFile !== "index.html") return;

          e.preventDefault();
          history.replaceState(null, "", window.location.pathname + window.location.search);
          window.scrollTo({ top: 0, behavior: "smooth" });
          updateActiveNav();
          if (e.detail > 0) a.blur();
        });
      }
    });
  }
});

window.addEventListener("load", () => {
  if (window.location.hash === "#gallery") maybeAutoScrollGallery();
});
