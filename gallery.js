(async function () {
  // 1. Fetch the list of artworks
  const resp = await fetch("data/gallery.json");
  const artworks = await resp.json();

  // 2. Select the container for images
  const container = document.getElementById("gallery-container");

  // 3. Populate each artwork as a square image in a 2×2 grid
  artworks.forEach((art) => {
    const wrapper = document.createElement("div");
    wrapper.className = "gallery-item"; // (for optional styling)

    const img = document.createElement("img");
    img.src = art.image_url;
    img.alt = art.title;

    // Clicking goes to detail page: detail.html?id=<ID>
    wrapper.addEventListener("click", () => {
      window.location.href = `detail.html?id=${art.id}`;
    });

    wrapper.appendChild(img);
    container.appendChild(wrapper);
  });
})();
