function normalizePath(p) {
  return (p || "").split("?")[0].split("#")[0];
}

document.addEventListener("DOMContentLoaded", () => {
  const links = Array.from(document.querySelectorAll(".top-nav .nav-link"));
  if (!links.length) return;

  const current = normalizePath(window.location.pathname);
  const currentFile = current.split("/").pop() || "index.html";

  links.forEach((a) => {
    const hrefFile = normalizePath(a.getAttribute("href") || "").split("/").pop();
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
  });
});
