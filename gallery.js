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
