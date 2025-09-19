import { $, $q, setText, setHTML, px } from "./utils.js";
import { openImageLightbox, closeImageLightbox } from "./lightbox.js";
import { installHighlightSelection } from "./selection.js";
import { buildMap, processProvenanceOnMap, plotPlaces } from "./map.js";
import { drawNetworkForEvent, openEnlargedEventNetwork } from "./localNetwork.js";
import { drawSocialNetwork } from "./socialNetwork.js";
import { renderInteractiveProvenanceD3 } from "./provenanceRenderer.js";
import { getFilenameBase } from "./utils.js";

// 安装全局高亮 API（保持与旧代码兼容）
installHighlightSelection();

// DOM 顶部 UI：说明与 Lightbox 控件
document.addEventListener("DOMContentLoaded", () => {
  const instructionsModal = $("instructions-modal");
  const instructionsClose = $("instructions-close");
  const instructionsIcon = $("instructions-icon");

  instructionsClose?.addEventListener("click", () => {
    instructionsIcon?.classList.remove("hidden");
    instructionsModal?.classList.add("hidden");
  });
  instructionsIcon?.addEventListener("click", () => {
    instructionsModal?.classList.remove("hidden");
    instructionsIcon?.classList.add("hidden");
  });

  $("lightbox-close")?.addEventListener("click", closeImageLightbox);
  $("back-to-gallery")?.addEventListener("click", () => (window.location.href = "index.html"));
});

// 保持对外 API：initProvenance（挂到 window 上）
async function initProvenance(json) {
  const {
    artworkData = {},
    placeData = {},
    provenanceEvents = [],
    socialNetwork: socialNetworkData = null,
    provenanceTimeline = null,
  } = json || {};

  // 顶部信息
  setText("artist-name", artworkData.artistName);
  setText("location-year", `${artworkData.location}, ${artworkData.creationYear}`);
  setText("artwork-name-year", `${artworkData.artworkName} (${artworkData.artworkYear})`);
  setText("artwork-medium", artworkData.medium);
  setText("intro-text", artworkData.intro);
  setHTML("current-museum", `Current Museum: <a href="${artworkData.museumUrl}" target="_blank">${artworkData.museumName}</a>`);

  const artImg = $("artwork-image");
  const artImgCol = $("image-col");
  const wallLabel = $q(".wall-label");
  if (artImgCol && wallLabel) artImgCol.style.height = px(wallLabel.clientHeight);
  if (artImg) {
    artImg.src = artworkData.imageUrl;
    artImg.alt = artworkData.artworkName || "Art Image";
  }

  // 地图 + 事件绘制
  const map = buildMap("map");
  const { placeCounts } = processProvenanceOnMap({
    map,
    provenanceEvents,
    placeData,
    onLineClick: (idx) => openEventModal(idx),
  });
  plotPlaces({ map, placeData, placeCounts, provenanceEvents, openEventModal });

  // 事件 Modal 控制
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

    if (eventTitleEl) eventTitleEl.textContent = ev.title;
    if (eventTextEl) eventTextEl.innerHTML = `<p>${ev.text}</p>`;

    const sanitizedBase = getFilenameBase(artworkData.imageUrl);
    const eventImgUrl = `assets/${sanitizedBase}-${ev.id}.jpg`;
    if (eventThumbEl) {
      eventThumbEl.style.display = "block";
      eventThumbEl.alt = ev.imageAlt || "Event Image";
      eventThumbEl.onerror = () => { eventThumbEl.style.display = "none"; };
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

    // 关键联动
    window.highlightItemsForStory(idx);
    drawNetworkForEvent(ev);
  }

  prevBtn?.addEventListener("click", () => {
    window.__provSelection = { mode: "story" };
    openEventModal(currentIndex - 1);
  });
  nextBtn?.addEventListener("click", () => {
    window.__provSelection = { mode: "story" };
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

  // 社交网络（若存在）
  if (socialNetworkData) {
    const onPageContainer = d3.select("#social-network-container .placeholder-content");
    if (!onPageContainer.empty()) {
      const w = onPageContainer.node().clientWidth;
      const h = onPageContainer.node().clientHeight;
      drawSocialNetwork(onPageContainer, w, h, socialNetworkData);
    }
  }

  // 渲染文字与时间轴
  renderInteractiveProvenanceD3(provenanceTimeline, provenanceEvents, openEventModal);

  // 默认打开第一个事件
  if (provenanceEvents.length > 0) openEventModal(0);
}

// 读取 ?id 并加载 JSON，保持你原流程
(async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const artworkId = params.get("id");
  if (!artworkId) {
    alert("No artwork ID provided in the URL.");
    return;
  }
  try {
    const dataFile = `data/${artworkId}.json`;
    const resp = await fetch(dataFile);
    const json = await resp.json();
    await initProvenance(json);
  } catch (err) {
    console.error("Could not load JSON for artwork:", err);
    alert("Error loading artwork data. Check console for details.");
  }
})();

// 向外暴露与兼容旧代码
window.initProvenance = initProvenance;
window.renderInteractiveProvenanceD3 = renderInteractiveProvenanceD3; // 如果外部需要直接用
