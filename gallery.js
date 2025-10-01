(async function () {
  try {
    const resp = await fetch("data/gallery.json", { cache: "no-store" });
    const artworks = await resp.json();

    const container = document.getElementById("gallery-container");
    if (!Array.isArray(artworks) || artworks.length === 0) {
      container.innerHTML = "<p>No artworks available.</p>";
      return;
    }

    artworks.forEach((art) => {
      const item = document.createElement("article");
      item.className = "gallery-item";
      item.tabIndex = 0; // keyboard focus
      item.setAttribute(
        "aria-label",
        `${art.artist}, ${art.title} (${art.date}) — ${art.museum}`
      );
      item.setAttribute("role", "button");

      const ratio = document.createElement("div");
      ratio.className = "ratio-box";

      const img = document.createElement("img");
      img.src = art.image_url;
      img.alt = art.title || "Artwork";
      img.loading = "lazy";
      img.decoding = "async";

      const caption = document.createElement("div");
      caption.className = "image-caption";
      caption.innerText = `${art.artist}, ${art.title} (${art.date})\n${art.museum}`;

      const goDetail = () => {
        window.location.href = `detail.html?id=${encodeURIComponent(art.id)}`;
      };

      item.addEventListener("click", goDetail);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goDetail();
        }
      });

      ratio.appendChild(img);
      item.appendChild(ratio);
      item.appendChild(caption);
      container.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    const container = document.getElementById("gallery-container");
    if (container) container.innerHTML = "<p>Failed to load artworks.</p>";
  }
})();


//#endregion Scroll cue logic

(function () {
  const cue = document.querySelector('.scroll-cue') || (() => {
    const el = document.createElement('button');
    el.className = 'scroll-cue';
    el.setAttribute('aria-label', 'Scroll for more');
    el.title = 'Scroll for more';
    el.innerHTML = '<svg class="chevron" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.body.appendChild(el);
    return el;
  })();

  const SHOW_THRESHOLD = 24; // px of overflow beyond viewport
  const HIDE_AFTER_SCROLL_Y = 160; // hide once user moved a bit
  const NEAR_BOTTOM_PADDING = 40; // hide when close to bottom

  function hasOverflow() {
    const doc = document.documentElement;
    return (doc.scrollHeight - doc.clientHeight) > SHOW_THRESHOLD;
  }

  function nearBottom() {
    const doc = document.documentElement;
    const scrollBottom = doc.scrollHeight - (doc.scrollTop + window.innerHeight);
    return scrollBottom < NEAR_BOTTOM_PADDING;
  }

  function updateVisibility() {
    if (window.innerWidth <= 700) { cue.classList.remove('is-visible'); return; }
    if (hasOverflow() && window.scrollY < HIDE_AFTER_SCROLL_Y && !nearBottom()) {
      cue.classList.add('is-visible');
    } else {
      cue.classList.remove('is-visible');
    }
  }

  // Click scroll: nudge almost one viewport down
  cue.addEventListener('click', () => {
    window.scrollBy({ top: Math.floor(window.innerHeight * 0.85), left: 0, behavior: 'smooth' });
  });

  // Recompute on resize/content changes/scroll
  window.addEventListener('scroll', updateVisibility, { passive: true });
  window.addEventListener('resize', updateVisibility);

  // Watch for dynamic content (gallery loading, images)
  const ro = new ResizeObserver(updateVisibility);
  ro.observe(document.documentElement);

  // Images may change layout as they load
  window.addEventListener('load', updateVisibility);
  setTimeout(updateVisibility, 200); // one more pass after initial scripts
})();