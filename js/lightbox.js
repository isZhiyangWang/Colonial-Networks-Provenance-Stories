import { $, setHTML } from "./utils.js";

export function openImageLightbox(imgSrc, sourceHTML) {
  const lb = $("image-lightbox");
  const lbImg = $("lightbox-img");
  const lbText = $("lightbox-text");
  if (!lb || !lbImg || !lbText) return;

  lbImg.src = imgSrc;
  if (sourceHTML) {
    setHTML("lightbox-text", sourceHTML);
    lbText.style.display = "block";
  } else {
    lbText.style.display = "none";
  }
  lb.classList.remove("hidden");
}

export function closeImageLightbox() {
  $("image-lightbox")?.classList.add("hidden");
}
