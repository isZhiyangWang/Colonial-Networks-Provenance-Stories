(async function () {
  // 1. Fetch the list of artworks (with extended fields)
  const resp = await fetch("data/gallery.json");
  const artworks = await resp.json();

  // 2. Select the container for images
  const container = document.getElementById("gallery-container");

  // 3. Populate each artwork
  artworks.forEach((art) => {
    // Create a wrapper div
    const wrapper = document.createElement("div");
    wrapper.className = "gallery-item"; // for styling

    // Create the image
    const img = document.createElement("img");
    img.src = art.image_url;
    img.alt = art.title;

    // Create the hover caption
    const caption = document.createElement("div");
    caption.className = "image-caption";
    // You can style the text however you like; here's a simple concatenation:
    caption.innerText = `${art.artist}, ${art.title} (${art.date})\n${art.museum}`;

    // Clicking the wrapper goes to detail.html?id=<ID>
    wrapper.addEventListener("click", () => {
      window.location.href = `detail.html?id=${art.id}`;
    });

    // Add the image and the caption to the wrapper
    wrapper.appendChild(img);
    wrapper.appendChild(caption);

    // Add the wrapper to the main container
    container.appendChild(wrapper);
  });
})();
