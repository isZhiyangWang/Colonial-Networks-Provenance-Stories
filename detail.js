/********************************************
 * Utilities (纯工具函数：无副作用)
 ********************************************/
const $ = (id) => document.getElementById(id);
const $q = (sel) => document.querySelector(sel);
const setText = (id, text) => { const el = $(id); if (el) el.textContent = text ?? ""; };
const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html ?? ""; };
const px = (n) => `${n}px`;

/** Utility: remove extension from image URL */
function getFilenameBase(url = "") {
  const parts = url.split("/");
  const filename = parts[parts.length - 1] || "";
  return filename.replace(/\.[^.]+$/, "");
}

/** Lightbox for images (vertical & centered) */
function openImageLightbox(imgSrc, sourceHTML) {
  const lb = $("image-lightbox");
  const lbImg = $("lightbox-img");
  const lbText = $("lightbox-text");
  if (!lb || !lbImg || !lbText) return;

  lbImg.src = imgSrc;
  if (sourceHTML) {
    lbText.innerHTML = sourceHTML;
    lbText.style.display = "block";
  } else {
    lbText.style.display = "none";
  }
  lb.classList.remove("hidden");
}
function closeImageLightbox() { $("image-lightbox")?.classList.add("hidden"); }

/********************************************
 * 入口：根据 ?id 加载 JSON 并初始化
 ********************************************/
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

/********************************************
 * 顶部 UI：说明弹窗
 ********************************************/
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

/********************************************
 * 主初始化（保持函数名不变）
 ********************************************/
async function initProvenance(json) {
  // ---------- 1) 解构 ----------
  const {
    artworkData = {},
    placeData = {},
    provenanceEvents = [],
    socialNetwork: socialNetworkData = null,
    provenanceTimeline = null,
  } = json || {};

  // ---------- 2) 顶部信息 ----------
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

  // ---------- 3) 地图 ----------
  const map = L.map("map");
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

  const placeCounts = {};
  let lastLocation = null;

  // 小工具：在两点之间画线并在中点放标签
  const addLineWithLabel = (startCoords, endCoords, lineOpts, labelText) => {
    const line = L.polyline([startCoords, endCoords], lineOpts).addTo(map);
    const midLat = (startCoords[0] + endCoords[0]) / 2;
    const midLng = (startCoords[1] + endCoords[1]) / 2;
    L.marker([midLat, midLng], {
      icon: L.divIcon({ className: "map-label", html: labelText || "", iconAnchor: [0, 0] }),
      interactive: false,
    }).addTo(map);
    return line;
  };

  // 标准化设定单一地点计数
  const bumpPlaceCount = (key) => { placeCounts[key] = (placeCounts[key] || 0) + 1; };

  provenanceEvents.forEach((ev, index) => {
    ev.singlePlace = null;

    if (ev.changedLocation) {
      const pairs = ev.networkPairs || [];

      // 网络搬运线（灰色）
      if (pairs.length > 0) {
        pairs.forEach((pair) => {
          const from = placeData[pair.source];
          const to = placeData[pair.target];
          if (!from || !to || pair.source === pair.target) return;

          const line = addLineWithLabel(from.coords, to.coords, {
            color: "#555", weight: 3, opacity: 0.8,
          }, pair.label || "");
          line.on("click", () => openEventModal(index));
        });
      }

      // from → to（虚线红色）
      if (ev.from && ev.to && ev.from !== ev.to && placeData[ev.from] && placeData[ev.to]) {
        addLineWithLabel(placeData[ev.from].coords, placeData[ev.to].coords, {
          color: "#e74c3c", weight: 2, opacity: 0.7, dashArray: "5,5",
        }, ev.eventType || "moved");
      }

      const finalLoc = ev.to;
      if (finalLoc && placeData[finalLoc]) {
        ev.singlePlace = finalLoc;
        bumpPlaceCount(finalLoc);
        lastLocation = finalLoc;
      } else if (lastLocation) {
        ev.singlePlace = lastLocation;
        bumpPlaceCount(lastLocation);
      }
    } else {
      if (ev.from && placeData[ev.from]) {
        ev.singlePlace = ev.from;
        bumpPlaceCount(ev.from);
        lastLocation = ev.from;
      } else if (lastLocation) {
        ev.singlePlace = lastLocation;
        bumpPlaceCount(lastLocation);
      }
    }
  });

  // 地点标记与气泡
  const allCoords = [];
  Object.keys(placeData).forEach((placeKey) => {
    const info = placeData[placeKey];
    if (!info?.coords) return;
    allCoords.push(info.coords);

    const count = placeCounts[placeKey] || 0;
    const markerRadius = 8 + count * 4;

    const marker = L.circleMarker(info.coords, {
      radius: markerRadius, color: "#e67e22", fillColor: "#e67e22", fillOpacity: 0.85,
    }).addTo(map);

    marker.bindTooltip(info.name, { permanent: true, direction: "right", offset: L.point(10, 0) });

    if (count > 0) {
      const badge = L.divIcon({ className: "map-badge", html: count });
      L.marker(info.coords, { icon: badge, interactive: false }).addTo(map);
    }

    // 计算与该地点相关的事件
    const relevant = provenanceEvents.filter((ev) => {
      if (ev.singlePlace === placeKey) return true;
      if (ev.from === placeKey || ev.to === placeKey) return true;
      if (ev.networkPairs?.length) return ev.networkPairs.some(
        (p) => p.source === placeKey || p.target === placeKey
      );
      return false;
    });

    marker.on("click", () => {
      if (relevant.length === 1) {
        const eIdx = provenanceEvents.indexOf(relevant[0]);
        openEventModal(eIdx);
        return;
      }
      if (relevant.length > 1) {
        let html = "<strong>Multiple events here:</strong><br/>";
        relevant.forEach((evObj) => {
          const idx = provenanceEvents.indexOf(evObj);
          html += `<a href="#" data-ev="${idx}">${evObj.title}</a><br/>`;
        });
        marker.bindPopup(html).openPopup();
        setTimeout(() => {
          document.querySelectorAll("[data-ev]").forEach((a) => {
            a.addEventListener("click", (e) => {
              e.preventDefault();
              const evId = parseInt(a.getAttribute("data-ev"), 10);
              marker.closePopup();
              openEventModal(evId);
            });
          });
        }, 50);
      } else {
        marker.bindPopup("No events here.").openPopup();
      }
    });
  });

  // 自适应视野
  setTimeout(() => {
    map.invalidateSize();
    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
    } else {
      map.setView([48.8566, 2.3522], 5);
    }
  }, 100);

  // ---------- 4) 事件 Modal/网络 相关 ----------
  let currentIndex = 0;
  let currentEventData = null;

  const eventTitleEl = $("overlay-event-title");
  const eventThumbEl = $("overlay-artwork-thumb");
  const eventTextEl = $("overlay-event-text");
  const sourceDiv = $("overlay-image-source");

  const prevBtn = $("prev-event");
  const nextBtn = $("next-event");
  const magnifyBtn = $("magnify-event-network");

  // 在 initProvenance 里替换这个函数，函数名保持不变
  function highlightItemsForStory(storyId) {
    // 若没有外部指定 selection（如 map/prev/next），默认走“story 模式”
    if (!window.__provSelection || window.__provSelection.mode === "story" || window.__provSelection.storyId !== storyId) {
      window.__provSelection = { mode: "story", storyId };
    } else {
      // 已有 entry/timeline 模式，更新 storyId 保留“单选偏好”
      window.__provSelection.storyId = storyId;
    }
    if (typeof window.highlightSelection === "function") {
      window.highlightSelection(window.__provSelection);
    }
  }

  // 提供全局的高亮实现（entry-only 也可用）
  window.highlightSelection = function (sel) {
    // 清理所有旧类
    d3.selectAll(
      ".provenance-entry.highlighted, .provenance-entry.sub-highlight, .timeline-item.highlighted, " +
      ".provenance-entry.is-primary, .provenance-entry.is-related, .timeline-item.is-primary, .timeline-item.is-related"
    ).classed("highlighted", false).classed("sub-highlight", false)
      .classed("is-primary", false).classed("is-related", false);

    if (!sel) return;

    const mapSel = window.__provMap || {};
    const storyId = sel.storyId;
    const entryId = sel.entryId;

    // 只有 entry 的情况：只高亮该 entry
    if ((storyId === null || storyId === undefined) && sel.mode === "entry" && entryId) {
      const main = d3.selectAll("span.provenance-entry")
        .filter(function () { return d3.select(this).datum().id === entryId; })
        .classed("is-primary", true);
      if (!main.empty()) main.nodes()[0].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      return;
    }

    // 一般有 storyId 的情况
    // 1) 时间轴：相关 is-related，首选 is-primary
    if (storyId !== null && storyId !== undefined) {
      const tlSel = d3.selectAll(`.timeline-item[data-story-id='${storyId}']`).classed("is-related", true);
      let primaryTimelineNode = null;
      if (sel.mode === "timeline" && typeof sel.preferredTimelineIndex === "number") {
        tlSel.each(function () { if (+this.getAttribute("data-idx") === sel.preferredTimelineIndex) primaryTimelineNode = this; });
      }
      if (!primaryTimelineNode && !tlSel.empty()) primaryTimelineNode = tlSel.nodes()[0];
      if (primaryTimelineNode) {
        d3.select(primaryTimelineNode).classed("is-primary", true);
        primaryTimelineNode.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }

    // 2) 文段：相关 is-related，主 entry is-primary
    const relatedEntryIds = (mapSel.storyIdToEntryIds && storyId !== null && storyId !== undefined)
      ? (mapSel.storyIdToEntryIds[storyId] || [])
      : [];

    let primaryEntryId = null;
    if (sel.mode === "entry" && entryId && relatedEntryIds.includes(entryId)) {
      primaryEntryId = entryId;
    } else if (mapSel.primaryEntryForStory && storyId !== null && storyId !== undefined) {
      primaryEntryId = mapSel.primaryEntryForStory[storyId];
    }

    relatedEntryIds.forEach((eid) => {
      const span = d3.selectAll("span.provenance-entry")
        .filter(function () { return d3.select(this).datum().id === eid; })
        .classed("is-related", true);
      if (eid === primaryEntryId) span.classed("is-primary", true);
    });

    if (primaryEntryId) {
      const mainSel = d3.selectAll("span.provenance-entry")
        .filter(function () { return d3.select(this).datum().id === primaryEntryId; });
      if (!mainSel.empty()) mainSel.nodes()[0].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  function openEventModal(idx) {
    if (idx < 0 || idx >= provenanceEvents.length) return;
    currentIndex = idx;

    // NEW：兜底选择器（map/初次进入/prev-next）
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
    highlightItemsForStory(idx);
    drawNetworkForEvent(ev);
  }

  prevBtn?.addEventListener("click", () => {
    window.__provSelection = { mode: "story" }; // 切页 = 全选模式
    openEventModal(currentIndex - 1);
  });
  nextBtn?.addEventListener("click", () => {
    window.__provSelection = { mode: "story" }; // 切页 = 全选模式
    openEventModal(currentIndex + 1);
  });

  eventThumbEl?.addEventListener("click", () => {
    if (!currentEventData || !eventThumbEl) return;
    openImageLightbox(eventThumbEl.src, currentEventData.imageSource || "");
  });

  $("magnify-event-network")?.addEventListener("click", () => {
    if (!currentEventData) return;
    openEnlargedEventNetwork(currentEventData);
  });

  // ------ 局部网络图（Modal 侧） ------
  function drawNetworkForEvent(ev) {
    const container = d3.select("#overlay-network");
    container.selectAll("svg").remove();

    const parent = document.querySelector(".col-middle");
    if (!parent) { console.error("Parent container `.col-middle` not found!"); return; }

    const w = parent.clientWidth;
    const h = parent.clientHeight;

    const svg = container.append("svg")
      .attr("width", w).attr("height", h)
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("display", "block")
      .style("margin", "auto");

    renderLocalNetwork(svg, w, h, ev);
  }

  // 这个函数应用了新的可视化风格，但保留了力导向布局
  function renderLocalNetwork(svg, w, h, ev) {
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrowhead-local")
      .attr("markerWidth", 10).attr("markerHeight", 10)
      .attr("refX", 22).attr("refY", 3).attr("orient", "auto")
      .append("path").attr("d", "M0,0 L0,6 L9,3 z").attr("fill", "#999");

    if (!ev.networkPairs?.length) {
      svg.append("text").attr("x", 20).attr("y", 20)
        .text("No movement or no networkPairs.").style("font-size", "14px");
      return;
    }

    const nodeNames = new Set();
    ev.networkPairs.forEach((pair) => { nodeNames.add(pair.source); nodeNames.add(pair.target); });

    const nodes = Array.from(nodeNames).map((name) => {
      const found = ev.participants?.find((pt) => pt.name === name);
      const t = found ? found.type : "person";
      return { id: name, type: t };
    });

    const links = ev.networkPairs.map((pair) => ({ source: pair.source, target: pair.target, label: pair.label || "" }));

    const sim = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-200))
      .force("link", d3.forceLink(links).id((d) => d.id).distance(120))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .on("tick", ticked);

    const link = svg.selectAll(".local-link").data(links).enter()
      .append("line").attr("class", "local-link")
      .attr("stroke", "#999").attr("stroke-width", 2).attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead-local)");

    const linkLabel = svg.selectAll(".local-link-label").data(links).enter()
      .append("text").attr("class", "local-link-label")
      .style("font-size", "10px").style("fill", "#555")
      .text((d) => d.label);

    const nodeGroup = svg.selectAll(".local-node-group").data(nodes).enter()
      .append("g").attr("class", "local-node-group")
      .call(d3.drag()
        .on("start", (evt, d) => { if (!evt.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (evt, d) => { d.fx = evt.x; d.fy = evt.y; })
        .on("end", (evt, d) => { if (!evt.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    nodeGroup.append("circle").attr("r", 12)
      .attr("fill", (d) => getColorForType(d.type))
      .attr("stroke", "#fff").attr("stroke-width", 1.5);

    nodeGroup.append("text").attr("class", "local-node-label")
      .style("font-size", "12px").style("fill", "#333")
      .attr("dy", -18).attr("text-anchor", "middle").text((d) => d.id);

    // 交互高亮
    nodeGroup
      .on("mouseover", function (event, d) {
        const connectedIds = new Set([d.id]);
        links.forEach((l) => {
          if (l.source.id === d.id) connectedIds.add(l.target.id);
          if (l.target.id === d.id) connectedIds.add(l.source.id);
        });
        nodeGroup.style("opacity", 0.1);
        link.style("opacity", 0.1);
        linkLabel.style("opacity", 0.1);

        nodeGroup.filter((n) => connectedIds.has(n.id)).style("opacity", 1);
        link.filter((l) => connectedIds.has(l.source.id) && connectedIds.has(l.target.id))
          .style("opacity", 1).attr("stroke", "#555");
        linkLabel.filter((l) => l.source.id === d.id || l.target.id === d.id)
          .style("opacity", 1).style("font-weight", "bold");
      })
      .on("mouseout", function () {
        nodeGroup.style("opacity", 1);
        link.style("opacity", 1).attr("stroke", "#999");
        linkLabel.style("opacity", 1).style("font-weight", "normal");
      });

    function ticked() {
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);

      linkLabel.attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2);

      nodeGroup.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    }
  }

  function openEnlargedEventNetwork(ev) {
    const overlay = $("event-network-lightbox");
    const closeBtn = $("event-network-close");
    if (!overlay || !closeBtn) return;

    overlay.classList.remove("hidden");
    closeBtn.onclick = () => {
      overlay.classList.add("hidden");
      d3.select("#event-network-zoomed-container").selectAll("*").remove();
    };

    setText("event-network-title", ev.title || "Event Network (Enlarged)");

    const container = d3.select("#event-network-zoomed-container");
    container.selectAll("*").remove();

    const w = container.node().clientWidth;
    const h = container.node().clientHeight;

    const svg = container.append("svg")
      .attr("width", w).attr("height", h).style("background", "#fdfdfd");

    const zoomContainer = svg.append("g");

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrowEnlarge")
      .attr("markerWidth", 10).attr("markerHeight", 10)
      .attr("refX", 24).attr("refY", 3).attr("orient", "auto")
      .append("path").attr("d", "M0,0 L0,6 L9,3 z").attr("fill", "#888");

    if (!ev.networkPairs?.length) return;

    const nodeNames = new Set();
    ev.networkPairs.forEach((pair) => { nodeNames.add(pair.source); nodeNames.add(pair.target); });
    const nodes = Array.from(nodeNames).map((name) => {
      const found = ev.participants?.find((pt) => pt.name === name);
      return { id: name, type: found ? found.type : "person" };
    });
    const links = ev.networkPairs.map((pair) => ({ source: pair.source, target: pair.target, label: pair.label || "" }));

    const sim = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-250))
      .force("link", d3.forceLink(links).id((d) => d.id).distance(130))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .on("tick", ticked);

    const link = zoomContainer.selectAll(".enlarged-link").data(links).enter()
      .append("line").attr("class", "enlarged-link")
      .attr("stroke", "#999").attr("stroke-width", 2).attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowEnlarge)");

    const linkLabel = zoomContainer.selectAll(".enlarged-link-label").data(links).enter()
      .append("text").attr("class", "enlarged-link-label")
      .style("font-size", "11px").style("fill", "#555").style("pointer-events", "none")
      .text((d) => d.label);

    const nodeGroup = zoomContainer.selectAll(".enlarged-node-group").data(nodes).enter()
      .append("g").attr("class", "enlarged-node-group").style("cursor", "pointer")
      .call(d3.drag()
        .on("start", (evt, d) => { if (!evt.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (evt, d) => { d.fx = evt.x; d.fy = evt.y; })
        .on("end", (evt, d) => { if (!evt.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    nodeGroup.append("circle").attr("r", 14)
      .attr("fill", (d) => getColorForType(d.type))
      .attr("stroke", "#fff").attr("stroke-width", 2);

    nodeGroup.append("text").attr("class", "enlarged-node-label")
      .style("font-size", "12px").style("fill", "#333").style("pointer-events", "none")
      .attr("text-anchor", "middle").attr("dy", -20).text((d) => d.id);

    nodeGroup
      .on("mouseover", function (event, d) {
        const connectedIds = new Set([d.id]);
        links.forEach((l) => {
          if (l.source.id === d.id) connectedIds.add(l.target.id);
          if (l.target.id === d.id) connectedIds.add(l.source.id);
        });
        link.style("opacity", 0.1);
        linkLabel.style("opacity", 0.1);
        nodeGroup.style("opacity", 0.15);

        nodeGroup.filter((n) => connectedIds.has(n.id)).style("opacity", 1);
        link.filter((l) => connectedIds.has(l.source.id) && connectedIds.has(l.target.id))
          .style("opacity", 1).attr("stroke", "#333");
        linkLabel.filter((l) => l.source.id === d.id || l.target.id === d.id)
          .style("opacity", 1).style("font-weight", "bold");
      })
      .on("mouseout", function () {
        nodeGroup.style("opacity", 1);
        link.style("opacity", 1).attr("stroke", "#999");
        linkLabel.style("opacity", 1).style("font-weight", "normal");
      });

    const zoom = d3.zoom().scaleExtent([0.3, 8]).on("zoom", (event) => {
      zoomContainer.attr("transform", event.transform);
    });
    svg.call(zoom);

    function ticked() {
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      linkLabel.attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2);
      nodeGroup.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    }
  }

  function getColorForType(t = "") {
    switch (t.toLowerCase()) {
      case "place": return "#ffa500";
      case "museum": return "#ffff00";
      case "institution": return "#800080";
      case "greenperson": return "#008000";
      default: return "#1e90ff";
    }
  }

  // ---------- 5) Social Network（按原逻辑保留 API） ----------
  function drawSocialNetwork(container, w, h) {
    // 清理目标容器并移除旧的 tooltip
    container.selectAll("*").remove();
    d3.select("body").select("#tooltip").remove();

    const tooltip = d3.select("body").append("div")
      .attr("id", "tooltip")
      .style("position", "absolute").style("opacity", 0).style("pointer-events", "none")
      .style("background", "rgba(0, 0, 0, 0.85)").style("color", "#fff")
      .style("border-radius", "4px").style("padding", "8px 12px")
      .style("font-family", "Arial, sans-serif").style("font-size", "12px")
      .style("max-width", "350px").style("z-index", "9999");

    const svg = container.append("svg").attr("width", w).attr("height", h).style("background", "#fff");
    const zoomContainer = svg.append("g");

    const fixedNodeRadius = 12;
    const nodes = socialNetworkData.nodes.map((d) => ({ ...d, radius: fixedNodeRadius }));
    const links = socialNetworkData.edges.map((d) => ({ ...d }));

    const radius = Math.min(w, h) / 2 - 120;
    const centerX = w / 2, centerY = h / 2;
    const angleStep = (2 * Math.PI) / nodes.length;

    nodes.forEach((node, i) => {
      const angle = i * angleStep;
      node.x = centerX + radius * Math.cos(angle);
      node.y = centerY + radius * Math.sin(angle);
    });

    const linksWithCoords = links.map((link) => {
      const sourceNode = nodes.find((n) => n.id === link.source);
      const targetNode = nodes.find((n) => n.id === link.target);
      return { source: sourceNode, target: targetNode, relationship: link.relationship };
    });

    const link = zoomContainer.selectAll(".social-link").data(linksWithCoords).enter()
      .append("line").attr("class", "social-link")
      .attr("stroke", "#bbb").attr("stroke-width", 1.5)
      .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);

    const linkLabel = zoomContainer.selectAll(".social-link-label").data(linksWithCoords).enter()
      .append("text").attr("class", "social-link-label")
      .text((d) => d.relationship)
      .attr("x", (d) => (d.source.x + d.target.x) / 2).attr("y", (d) => (d.source.y + d.target.y) / 2)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial, sans-serif").style("font-size", "10px").style("font-weight", "normal")
      .style("fill", "#666").style("pointer-events", "none")
      .style("paint-order", "stroke").style("stroke", "white").style("stroke-width", "2px");

    const node = zoomContainer.selectAll(".social-node").data(nodes).enter()
      .append("g").attr("class", "social-node-group")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    node.append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => getColorForType(d.type))
      .attr("stroke", "#fff").attr("stroke-width", 1.5);

    linkLabel.raise();

    const nodeLabel = zoomContainer.selectAll(".node-label-group").data(nodes).enter()
      .append("text").attr("class", "social-node-label")
      .text((d) => d.id)
      .style("font-size", "12px").style("font-weight", "500")
      .style("fill", "#333").style("pointer-events", "none")
      .attr("text-anchor", (d, i) => {
        const angle = i * angleStep;
        return angle > Math.PI / 2 && angle < Math.PI * 1.5 ? "end" : "start";
      })
      .attr("dominant-baseline", "middle")
      .attr("x", (d, i) => {
        const angle = i * angleStep, offset = d.radius + 8;
        return d.x + offset * Math.cos(angle);
      })
      .attr("y", (d, i) => {
        const angle = i * angleStep, offset = d.radius + 8;
        return d.y + offset * Math.sin(angle);
      });

    const nodeGroups = zoomContainer.selectAll(".social-node-group");
    nodeGroups
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`<strong>${d.id}</strong><br/>${d.bio ?? ""}`)
          .style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 28}px`);

        const connectedIds = new Set([d.id]);
        links.forEach((l) => { if (l.source === d.id) connectedIds.add(l.target); if (l.target === d.id) connectedIds.add(l.source); });

        link.style("opacity", 0.1);
        nodeGroups.style("opacity", 0.1);
        nodeLabel.style("opacity", 0.1);
        linkLabel.style("opacity", 0.1);

        nodeGroups.filter((n) => connectedIds.has(n.id)).style("opacity", 1);
        nodeLabel.filter((n) => connectedIds.has(n.id)).style("opacity", 1).raise();
        link.filter((l) => connectedIds.has(l.source.id) && connectedIds.has(l.target.id)).style("opacity", 1);
        linkLabel.filter((l) => l.source.id === d.id || l.target.id === d.id)
          .style("opacity", 1).style("font-size", "13px").style("font-weight", "bold").raise();
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", function () {
        tooltip.transition().duration(300).style("opacity", 0);
        nodeGroups.style("opacity", 1);
        link.style("opacity", 1);
        nodeLabel.style("opacity", 1);
        linkLabel.style("opacity", 1).style("font-size", "10px").style("font-weight", "normal");
      });

    const zoom = d3.zoom().scaleExtent([0.3, 10]).on("zoom", (event) => {
      zoomContainer.attr("transform", event.transform);
    });
    svg.call(zoom);

    d3.select("#reset-zoom-btn").on("click", () => {
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });
  }

  if (socialNetworkData) {
    const onPageContainer = d3.select("#social-network-container .placeholder-content");
    if (!onPageContainer.empty()) {
      const w = onPageContainer.node().clientWidth;
      const h = onPageContainer.node().clientHeight;
      console.log("Drawing social network in on-page container with size:", w, h);
      drawSocialNetwork(onPageContainer, w, h);
    }
  }

  // ---------- 6) 渲染文字 + 时间轴 ----------
  renderInteractiveProvenanceD3(provenanceTimeline, provenanceEvents, openEventModal);

  // ---------- 7) 默认打开第一个事件 ----------
  if (provenanceEvents.length > 0) openEventModal(0);
}

/**
 * Renders an interactive provenance text block and a modern, horizontal timeline with scroll controls using D3.js.
 * @param {object} provenanceTimeline The 'provenanceTimeline' object from the JSON data.
 * @param {Array} provenanceEvents The 'provenanceEvents' array from the JSON data.
 * @param {Function} eventHandlerCallback A function to call when an interactive element is clicked, e.g., openEventModal.
 */
function renderInteractiveProvenanceD3(provenanceTimeline, provenanceEvents, eventHandlerCallback) {
  // --- 1. Containers & guard ---
  const provenanceContainer = d3.select("#story-div-placeholder");
  const timelineContainer = d3.select("#timeline-placeholder").attr("class", "timeline-container");

  if (!provenanceTimeline || !provenanceEvents || provenanceContainer.empty() || timelineContainer.empty()) {
    provenanceContainer.style("display", "none");
    timelineContainer.style("display", "none");
    console.warn("Provenance data or HTML placeholders are missing.");
    return;
  }
  provenanceContainer.style("display", "block").html("<h2>Provenance</h2>");

  // --- 2. helpers（仅用于顺序对齐；不改数据/文案） ---
  function normalize(s) {
    return (s ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  const STOP = new Set(["de","du","des","la","le","les","von","van","da","di","del","d","the","and","of","his","her","widow","son","daughter","estate","mr","mrs","ms","miss","sir","baron","count","comte","lord","lady"]);
  function nameTokens(nameLike) {
    const n = normalize(nameLike);
    if (!n) return [];
    return Array.from(new Set(n.split(" ").filter((w) => w && w.length >= 2 && !STOP.has(w))));
  }
  function extractOwnerAliases(entry) {
    const aliases = new Set();
    if (entry?.owner) aliases.add(entry.owner);
    if (entry?.fullText) {
      const lead = entry.fullText.split("(")[0];
      const widowFix = lead.replace(/\b(his|her)\s+widow[, ]+/i, "");
      const firstOwnerChunk = widowFix.split(";")[0];
      const namePart = firstOwnerChunk.split(",")[0];
      if (namePart?.trim()) aliases.add(namePart.trim());
    }
    return Array.from(aliases);
  }
  function textHasAlias(evText, aliasTokens, need) {
    if (!aliasTokens?.length) return false;
    const evTokens = nameTokens(evText);
    if (!evTokens.length) return false;
    const evSet = new Set(evTokens);
    let score = 0;
    for (const t of aliasTokens) if (evSet.has(t)) score++;
    return score >= (need || (aliasTokens.length >= 2 ? 2 : 1));
  }
  const CONTINUATION_HINTS = ["confiscated","restituted","sale","estate sale","sold","auction","gift","accessioned","bequeathed","presented","donated"].map(normalize);
  const looksLikeContinuation = (t) => CONTINUATION_HINTS.some((h) => normalize(t).includes(h));
  const isOutsideProvenance = (ev) => {
    const t = normalize(ev.event || "");
    if (t.includes("painted") || t.includes("exhibited") || t.includes("salon")) return true; // 1789
    if (t.includes("accessioned")) return true; // 1906 accessioned
    return false;
  };

  // --- 3. 顺序贪心对齐：entries ↔ events ---
  const entries = provenanceTimeline.entries || [];
  const events = provenanceTimeline.events || [];
  const entryTokenList = entries.map((e) => {
    const aliases = extractOwnerAliases(e);
    const primary = aliases.length ? aliases[0] : "";
    return { id: e.id, tokens: nameTokens(primary), backupTokens: aliases.slice(1).flatMap((a) => nameTokens(a)) };
  });

  const entryToStoryMap = {};
  let evIdx = 0;
  for (let i = 0; i < entryTokenList.length; i++) {
    const curr = entryTokenList[i];
    const next = entryTokenList[i + 1] || null;

    // anchor
    let anchorIdx = -1;
    for (let j = evIdx; j < events.length; j++) {
      const ev = events[j];
      if (isOutsideProvenance(ev)) continue;
      const need = (curr.tokens.length >= 2 ? 2 : 1);
      const hitPrimary = textHasAlias(ev.event, curr.tokens, need);
      const hitBackup = !hitPrimary && curr.backupTokens.length > 0 ? textHasAlias(ev.event, curr.backupTokens, 1) : false;
      if (hitPrimary || hitBackup) { anchorIdx = j; break; }
    }
    if (anchorIdx === -1) continue;

    // collect storyIds
    const storyIds = new Set();
    const pushIfStory = (ev) => { if (ev.storyId !== null && ev.storyId !== undefined) storyIds.add(ev.storyId); };
    pushIfStory(events[anchorIdx]);

    // extend
    let k = anchorIdx + 1;
    for (; k < events.length; k++) {
      const ev = events[k];
      if (isOutsideProvenance(ev)) break;
      if (next) {
        const nextNeed = (next.tokens.length >= 2 ? 2 : 1);
        const hitNextPrimary = textHasAlias(ev.event, next.tokens, nextNeed);
        const hitNextBackup = !hitNextPrimary && next.backupTokens.length > 0 ? textHasAlias(ev.event, next.backupTokens, 1) : false;
        if (hitNextPrimary || hitNextBackup) break;
      }
      if (looksLikeContinuation(ev.event)) { pushIfStory(ev); } else { break; }
    }

    if (storyIds.size > 0) entryToStoryMap[curr.id] = Array.from(new Set(storyIds)).sort((a, b) => (a ?? 0) - (b ?? 0));
    evIdx = Math.max(anchorIdx + 1, k);
  }

  // --- 3b. 反向映射 + 主 entry ---
  const storyIdToEntryIds = {};
  Object.entries(entryToStoryMap).forEach(([eid, arr]) => (arr || []).forEach((sid) => {
    if (sid === null || sid === undefined) return;
    (storyIdToEntryIds[sid] ||= []).push(eid);
  }));
  const entryOrderIndex = {};
  entries.forEach((e, i) => entryOrderIndex[e.id] = i);
  Object.keys(storyIdToEntryIds).forEach((sid) => storyIdToEntryIds[sid].sort((a, b) => entryOrderIndex[a] - entryOrderIndex[b]));
  const primaryEntryForStory = {};
  Object.keys(storyIdToEntryIds).forEach((sid) => {
    const list = storyIdToEntryIds[sid];
    if (list?.length) primaryEntryForStory[sid] = list[0];
  });

  // 暴露到全局（仅数据层；UI 不改变）
  window.__provMap = { entryToStoryMap, storyIdToEntryIds, primaryEntryForStory, entryOrderIndex };

  // --- 4. 渲染 Provenance 文本 ---
  const provenanceParagraph = provenanceContainer.append("p");
  provenanceParagraph.selectAll("span.provenance-entry")
    .data(entries).enter().append("span")
    .attr("class", "provenance-entry")
    .style("cursor", (d) => (entryToStoryMap[d.id] ? "pointer" : "default"))
    .attr("data-story-ids", (d) => (entryToStoryMap[d.id] ? JSON.stringify(entryToStoryMap[d.id]) : null))
    .text((d) => d.fullText + " ")
    .on("click", function (event, d) {
      const storyIds = entryToStoryMap[d.id] || [];
      // 记录“单选”意图：entry 优先
      window.__provSelection = { mode: "entry", entryId: d.id, storyId: storyIds.length ? storyIds[0] : null };
      if (storyIds.length > 0) {
        eventHandlerCallback(storyIds[0]);
      } else {
        if (typeof window.highlightSelection === "function") window.highlightSelection(window.__provSelection);
      }
    });

  // --- 5. 渲染时间轴 ---
  const timelineWrapper = timelineContainer.append("div").attr("class", "timeline-wrapper");
  const timelineEl = timelineWrapper.append("div").attr("class", "timeline")
    .style("min-width", `${events.length * 180}px`);

  const timelineItems = timelineEl.selectAll(".timeline-item")
    .data(events).enter().append("div")
    .attr("class", "timeline-item")
    .attr("data-story-id", (d) => d.storyId)
    .attr("data-idx", (d, i) => i)
    .on("click", function () {
      const d = d3.select(this).datum();
      if (d.storyId === null || d.storyId === undefined) return;
      const idx = +this.getAttribute("data-idx");
      window.__provSelection = { mode: "timeline", storyId: d.storyId, preferredTimelineIndex: idx };
      eventHandlerCallback(d.storyId);
    });

  timelineItems.append("div").attr("class", "timeline-content")
    .append("div").attr("class", "timeline-event").text((d) => d.event);
  timelineItems.append("div").attr("class", "timeline-point");
  timelineItems.append("div").attr("class", "timeline-date-label").text((d) => d.date);

  // --- 6. 滚动按钮 ---
  const prevBtn = timelineContainer.append("button").attr("id", "timeline-scroll-prev").attr("class", "timeline-scroll-btn")
    .html('<span class="arrow">&#x2039;</span><span class="nav-text">Prev</span>');
  const nextBtn = timelineContainer.append("button").attr("id", "timeline-scroll-next").attr("class", "timeline-scroll-btn")
    .html('<span class="nav-text">Next</span><span class="arrow">&#x203A;</span>');

  function updateScrollButtons() {
    const el = timelineWrapper.node();
    prevBtn.classed("hidden", el.scrollLeft <= 2);
    nextBtn.classed("hidden", el.scrollLeft >= el.scrollWidth - el.clientWidth - 2);
  }
  prevBtn.on("click", () => timelineWrapper.node().scrollBy({ left: -360, behavior: "smooth" }));
  nextBtn.on("click", () => timelineWrapper.node().scrollBy({ left: 360, behavior: "smooth" }));
  timelineWrapper.on("scroll", updateScrollButtons);
  new ResizeObserver(updateScrollButtons).observe(timelineWrapper.node());
  setTimeout(updateScrollButtons, 100);
}
