import { $, $q, setText, setHTML, px, getFilenameBase } from "./utils.js";
import { openImageLightbox, closeImageLightbox } from "./lightbox.js";
import { installHighlightSelection } from "./selection.js";
import { buildMap, processProvenanceOnMap, plotPlaces } from "./map.js";
import { drawNetworkForEvent, openEnlargedEventNetwork } from "./localNetwork.js";
import { drawSocialNetwork } from "./socialNetwork.js";
import { renderInteractiveProvenanceD3 } from "./provenanceRenderer.js";

installHighlightSelection();

document.addEventListener("DOMContentLoaded", () => {
  const modal = $("instructions-modal");
  const closeBtn = $("instructions-close");
  const icon = $("instructions-icon");

  closeBtn?.addEventListener("click", () => {
    icon?.classList.remove("hidden");
    modal?.classList.add("hidden");
  });

  icon?.addEventListener("click", () => {
    modal?.classList.remove("hidden");
    icon?.classList.add("hidden");
  });

  $("lightbox-close")?.addEventListener("click", closeImageLightbox);
  $("back-to-gallery")?.addEventListener("click", () => {
    window.location.href = "index.html";
  });
});

// --- Loading cover -----------------------------------------------------------

function showLoadingCover() {
  const el = $("page-loading");
  if (!el) return;
  el.classList.remove("hidden");
  el.classList.remove("is-done");
}

function hideLoadingCover(ms = 450) {
  const el = $("page-loading");
  if (!el) return;

  el.classList.add("is-done");

  const finish = () => el.classList.add("hidden");
  el.addEventListener("transitionend", finish, { once: true });

  window.setTimeout(finish, ms);
}

function waitForImage(imgEl, timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (!imgEl) return resolve();
    if (imgEl.complete && imgEl.naturalWidth > 0) return resolve();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      imgEl.removeEventListener("load", finish);
      imgEl.removeEventListener("error", finish);
    };

    const timer = window.setTimeout(finish, timeoutMs);
    imgEl.addEventListener("load", finish, { once: true });
    imgEl.addEventListener("error", finish, { once: true });

    if (typeof imgEl.decode === "function") {
      imgEl.decode().then(finish).catch(() => {});
    }
  });
}

// --- Page init ---------------------------------------------------------------

async function initProvenance(json) {
  const {
    artworkData = {},
    placeData = {},
    provenanceEvents = [],
    socialNetwork: socialNetworkData = null,
    provenanceTimeline = null,
  } = json || {};

  document.title = `${artworkData.artworkName || "Artwork"} - Provenance Story`;
  setText("artist-name", artworkData.artistName);
  setText("location-year", `${artworkData.location}, ${artworkData.creationYear}`);
  setText("artwork-name-year", `${artworkData.artworkName} (${artworkData.artworkYear})`);
  setText("artwork-medium", artworkData.medium);
  setText("intro-text", artworkData.intro);
  setHTML(
    "current-museum",
    `Current Museum: <a href="${artworkData.museumUrl}" target="_blank">${artworkData.museumName}</a>`
  );

  const artImg = $("artwork-image");
  const artImgCol = $("image-col");
  const wallLabel = $q(".wall-label");

  if (artImgCol && wallLabel) artImgCol.style.height = px(wallLabel.clientHeight);
  if (artImg) {
    artImg.src = artworkData.imageUrl;
    artImg.alt = artworkData.artworkName || "Art Image";
  }

  const map = buildMap("map");
  const { placeCounts } = processProvenanceOnMap({
    map,
    provenanceEvents,
    placeData,
    onLineClick: (idx) => openEventModal(idx),
  });

  plotPlaces({ map, placeData, placeCounts, provenanceEvents, openEventModal });

  let currentIndex = 0;
  let currentEventData = null;

  const eventTitleEl = $("overlay-event-title");
  const eventThumbEl = $("overlay-artwork-thumb");
  const eventTextEl = $("overlay-event-text");
  const sourceDiv = $("overlay-image-source");

  const prevBtn = $("prev-event");
  const nextBtn = $("next-event");

  function openEventModal(idx) {
    if (idx < 0 || idx >= provenanceEvents.length) return;
    currentIndex = idx;

    if (!window.__provSelection || window.__provSelection.mode === "story") {
      window.__provSelection = { mode: "story", storyId: idx };
    } else {
      window.__provSelection.storyId = idx;
    }

    prevBtn?.classList.toggle("is-hidden", currentIndex === 0);
    nextBtn?.classList.toggle("is-hidden", currentIndex === provenanceEvents.length - 1);

    const ev = provenanceEvents[idx];
    currentEventData = ev;

    if (eventTitleEl) eventTitleEl.textContent = ev.title || "";
    if (eventTextEl) eventTextEl.innerHTML = `<p>${ev.text ?? ""}</p>`;

    const base = getFilenameBase(artworkData.imageUrl);
    const eventImgUrl = `assets/${base}-${ev.id}.jpg`;

    if (eventThumbEl) {
      eventThumbEl.style.display = "block";
      eventThumbEl.alt = ev.imageAlt || "Event Image";
      eventThumbEl.addEventListener(
        "error",
        () => {
          eventThumbEl.style.display = "none";
        },
        { once: true }
      );
      eventThumbEl.src = eventImgUrl;
    }

    if (sourceDiv) {
      if (ev.imageSource) {
        sourceDiv.innerHTML = ev.imageSource;
        sourceDiv.style.display = "block";
        sourceDiv.style.fontSize = "12px";
      } else {
        sourceDiv.style.display = "none";
      }
    }

    window.highlightItemsForStory(idx);
    drawNetworkForEvent(ev);
  }

  prevBtn?.addEventListener("click", () => {
    window.__provSelection = { mode: "story" };
    window.__suppressTimelineScrollOnce = true;
    openEventModal(currentIndex - 1);
  });

  nextBtn?.addEventListener("click", () => {
    window.__provSelection = { mode: "story" };
    window.__suppressTimelineScrollOnce = true;
    openEventModal(currentIndex + 1);
  });

  $("overlay-artwork-thumb")?.addEventListener("click", () => {
    if (!currentEventData) return;
    openImageLightbox($("overlay-artwork-thumb").src, currentEventData.imageSource || "");
  });

  $("magnify-event-network")?.addEventListener("click", () => {
    if (!currentEventData) return;
    openEnlargedEventNetwork(currentEventData);
  });

  if (socialNetworkData) {
    const container = d3.select("#social-network-container .placeholder-content");
    if (!container.empty()) {
      const w = container.node().clientWidth;
      const h = container.node().clientHeight;
      drawSocialNetwork(container, w, h, socialNetworkData);
    }
  }

  renderInteractiveProvenanceD3(provenanceTimeline, provenanceEvents, openEventModal);

  if (provenanceEvents.length > 0) openEventModal(0);
}

// --- Bootstrap ---------------------------------------------------------------

(async function bootstrap() {
  showLoadingCover();

  const params = new URLSearchParams(window.location.search);
  const artworkId = params.get("id");

  if (!artworkId) {
    hideLoadingCover();
    alert("No artwork ID provided in the URL.");
    return;
  }

  try {
    const dataFile = `data/${artworkId}.json`;
    const resp = await fetch(dataFile);
    const json = await resp.json();

    await initProvenance(json);

    const heroImg = $("artwork-image");
    await waitForImage(heroImg, 2500);

    requestAnimationFrame(() => hideLoadingCover());
  } catch (err) {
    console.error("Could not load JSON for artwork:", err);
    hideLoadingCover();
    alert("Error loading artwork data. Check console for details.");
  }
})();

window.initProvenance = initProvenance;
window.renderInteractiveProvenanceD3 = renderInteractiveProvenanceD3;
