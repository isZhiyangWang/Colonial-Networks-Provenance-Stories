async function initProvenance(json) {
  // 1. Deconstruct
  const artworkData = json.artworkData;
  const placeData = json.placeData;
  const provenanceEvents = json.provenanceEvents;
  const socialNetworkData = json.socialNetwork || null;
   const provenanceTimeline = json.provenanceTimeline || null;
  // 2. Top info
  document.getElementById("artist-name").textContent = artworkData.artistName;
  document.getElementById("location-year").textContent =
    artworkData.location + ", " + artworkData.creationYear;
  document.getElementById("artwork-name-year").textContent =
    artworkData.artworkName + " (" + artworkData.artworkYear + ")";
  document.getElementById("artwork-medium").textContent = artworkData.medium;
  document.getElementById("intro-text").textContent = artworkData.intro;
  document.getElementById("current-museum").innerHTML =
    `Current Museum: <a href="${artworkData.museumUrl}" target="_blank">${artworkData.museumName}</a>`;
  const artImg = document.getElementById("artwork-image");
  const artImgCol = document.getElementById("image-col");
  const wallLabel = document.querySelector(".wall-label");
  artImgCol.style.height = wallLabel.clientHeight + "px";
  artImg.src = artworkData.imageUrl;
  artImg.alt = artworkData.artworkName || "Art Image";

  // 3. Leaflet map
  const map = L.map("map");
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
  }).addTo(map);

  const placeCounts = {};
  let lastLocation = null;

  provenanceEvents.forEach((ev, index) => {
    ev.singlePlace = null;
    if (ev.changedLocation) {
      const pairs = ev.networkPairs || [];
      let finalLoc = ev.to;
      if (pairs.length > 0) {
        pairs.forEach((pair) => {
          const start = placeData[pair.source];
          const end = placeData[pair.target];
          if (start && end && pair.source !== pair.target) {
            const line = L.polyline([start.coords, end.coords], {
              color: "#555",
              weight: 3,
              opacity: 0.8,
            }).addTo(map);
            const midLat = (start.coords[0] + end.coords[0]) / 2;
            const midLng = (start.coords[1] + end.coords[1]) / 2;
            L.marker([midLat, midLng], {
              icon: L.divIcon({
                className: "map-label",
                html: pair.label || "",
                iconAnchor: [0, 0],
              }),
              interactive: false,
            }).addTo(map);
            line.on("click", () => openEventModal(index));
          }
        });
      }
      if (
        ev.from &&
        ev.to &&
        ev.from !== ev.to &&
        placeData[ev.from] &&
        placeData[ev.to]
      ) {
        const line = L.polyline(
          [placeData[ev.from].coords, placeData[ev.to].coords],
          {
            color: "#e74c3c",
            weight: 2,
            opacity: 0.7,
            dashArray: "5,5",
          }
        ).addTo(map);
        const midLat =
          (placeData[ev.from].coords[0] + placeData[ev.to].coords[0]) / 2;
        const midLng =
          (placeData[ev.from].coords[1] + placeData[ev.to].coords[1]) / 2;
        L.marker([midLat, midLng], {
          icon: L.divIcon({
            className: "map-label",
            html: ev.eventType || "moved",
            iconAnchor: [0, 0],
          }),
          interactive: false,
        }).addTo(map);
      }
      if (finalLoc && placeData[finalLoc]) {
        ev.singlePlace = finalLoc;
        placeCounts[finalLoc] = (placeCounts[finalLoc] || 0) + 1;
        lastLocation = finalLoc;
      } else {
        if (lastLocation) {
          ev.singlePlace = lastLocation;
          placeCounts[lastLocation] = (placeCounts[lastLocation] || 0) + 1;
        }
      }
    } else {
      if (ev.from && placeData[ev.from]) {
        ev.singlePlace = ev.from;
        placeCounts[ev.from] = (placeCounts[ev.from] || 0) + 1;
        lastLocation = ev.from;
      } else if (lastLocation) {
        ev.singlePlace = lastLocation;
        placeCounts[lastLocation] = (placeCounts[lastLocation] || 0) + 1;
      }
    }
  });

  const allCoords = [];
  Object.keys(placeData).forEach((placeKey) => {
    const info = placeData[placeKey];
    allCoords.push(info.coords);
    const baseRadius = 8;
    const count = placeCounts[placeKey] || 0;
    const markerRadius = baseRadius + count * 4;
    const marker = L.circleMarker(info.coords, {
      radius: markerRadius,
      color: "#e67e22",
      fillColor: "#e67e22",
      fillOpacity: 0.85,
    }).addTo(map);
    marker.bindTooltip(info.name, {
      permanent: true,
      direction: "right",
      offset: L.point(10, 0),
    });
    if (count > 0) {
      const badge = L.divIcon({ className: "map-badge", html: count });
      L.marker(info.coords, { icon: badge, interactive: false }).addTo(map);
    }
    const relevant = provenanceEvents.filter((ev) => {
      if (ev.singlePlace === placeKey) return true;
      if (ev.from === placeKey || ev.to === placeKey) return true;
      if (ev.networkPairs && ev.networkPairs.length > 0) {
        return ev.networkPairs.some(
          (p) => p.source === placeKey || p.target === placeKey
        );
      }
      return false;
    });
    marker.on("click", () => {
      if (relevant.length === 1) {
        const eIdx = provenanceEvents.indexOf(relevant[0]);
        openEventModal(eIdx);
      } else if (relevant.length > 1) {
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

  setTimeout(() => {
    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.invalidateSize();
      map.setView([48.8566, 2.3522], 5);
    }
  }, 100);

  // --- Start of section with all functions ---
  
  let currentIndex = 0;
  let currentEventData = null;

  const eventTitleEl = document.getElementById("overlay-event-title");
  const eventThumbEl = document.getElementById("overlay-artwork-thumb");
  const eventTextEl = document.getElementById("overlay-event-text");
  const sourceDiv = document.getElementById("overlay-image-source") || null;

  const prevBtn = document.getElementById("prev-event");
  const nextBtn = document.getElementById("next-event");
  const magnifyBtn = document.getElementById("magnify-event-network");
  
  // NOTE: All helper functions are now defined INSIDE initProvenance
  // so they are available to each other.
function highlightItemsForStory(storyId) {
    // Clear previous highlights
    d3.selectAll('.provenance-entry.highlighted, .timeline-item.highlighted')
      .classed('highlighted', false);

    if (storyId === null || storyId === undefined) return;

    // Highlight timeline items
    const timelineItems = d3.selectAll(`.timeline-item[data-story-id='${storyId}']`);
    timelineItems.classed('highlighted', true);
    
    // Scroll the FIRST highlighted item into the center of the view
    if (!timelineItems.empty()) {
      const firstNode = timelineItems.nodes()[0];
      firstNode.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Highlight provenance text spans
    d3.selectAll('span.provenance-entry[data-story-ids]').each(function() {
      const span = d3.select(this);
      const storyIds = JSON.parse(span.attr('data-story-ids') || '[]');
      if (storyIds.includes(storyId)) {
        span.classed('highlighted', true);
      }
    });
  }

  function openEventModal(idx) {
    if (idx < 0 || idx >= provenanceEvents.length) return;
    currentIndex = idx;

    prevBtn.classList.toggle('is-hidden', currentIndex === 0);
    nextBtn.classList.toggle('is-hidden', currentIndex === provenanceEvents.length - 1);

    const ev = provenanceEvents[idx];
    currentEventData = ev;

    eventTitleEl.textContent = ev.title;
    eventTextEl.innerHTML = `<p>${ev.text}</p>`;

    const sanitizedBase = getFilenameBase(artworkData.imageUrl);
    const eventImgUrl = `assets/${sanitizedBase}-${ev.id}.jpg`;
    eventThumbEl.style.display = "block";
    const altText = ev.imageAlt || "Event Image";
    eventThumbEl.alt = altText;
    eventThumbEl.onerror = () => {
      eventThumbEl.style.display = "none";
    };
    eventThumbEl.src = eventImgUrl;

    if (sourceDiv && ev.imageSource) {
      sourceDiv.innerHTML = ev.imageSource;
      sourceDiv.style.display = "block";
      sourceDiv.style.fontSize = "12px";
    } else if (sourceDiv) {
      sourceDiv.style.display = "none";
    }

    // THIS CALL WILL NOW WORK
    highlightItemsForStory(idx); // This line is crucial
  
    drawNetworkForEvent(ev);
  }
  
  prevBtn.addEventListener("click", () => {
    openEventModal(currentIndex - 1);
  });
  nextBtn.addEventListener("click", () => {
    openEventModal(currentIndex + 1);
  });
  eventThumbEl.addEventListener("click", () => {
    if (!currentEventData) return;
    openImageLightbox(eventThumbEl.src, currentEventData.imageSource || "");
  });
  magnifyBtn.addEventListener("click", () => {
    if (!currentEventData) return;
    openEnlargedEventNetwork(currentEventData);
  });
  
  function drawNetworkForEvent(ev) {
    const container = d3.select("#overlay-network");
    container.selectAll("svg").remove();

    const parent = document.querySelector(".col-middle");
    if (!parent) {
        console.error("Parent container `.col-middle` not found!");
        return;
    }

    const w = parent.clientWidth;
    const h = parent.clientHeight;

    const svg = container
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("display", "block")  
      .style("margin", "auto");  

    renderLocalNetwork(svg, w, h, ev);
  }

  // 这个函数应用了新的可视化风格，但保留了力导向布局
  function renderLocalNetwork(svg, w, h, ev) {
    // --- 改变: 清理 SVG，为重绘做准备 ---
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    defs.append("marker")
        .attr("id", "arrowhead-local")
        .attr("markerWidth", 10).attr("markerHeight", 10)
        .attr("refX", 22) // 稍微调整refX以适应节点半径
        .attr("refY", 3)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L0,6 L9,3 z").attr("fill", "#999");

    if (!ev.networkPairs || ev.networkPairs.length === 0) {
      svg.append("text").attr("x", 20).attr("y", 20)
         .text("No movement or no networkPairs.").style("font-size", "14px");
      return;
    }

    const nodeNames = new Set();
    ev.networkPairs.forEach(pair => {
      nodeNames.add(pair.source);
      nodeNames.add(pair.target);
    });

    const nodes = Array.from(nodeNames).map(name => {
      const found = ev.participants?.find(pt => pt.name === name);
      const t = found ? found.type : "person";
      return { id: name, type: t };
    });

    const links = ev.networkPairs.map(pair => ({
      source: pair.source,
      target: pair.target,
      label: pair.label || ""
    }));

    // --- 核心: 力导向布局保持不变 ---
    const sim = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-200))
      .force("link", d3.forceLink(links).id(d => d.id).distance(120))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .on("tick", ticked);

    const link = svg.selectAll(".local-link").data(links).enter()
      .append("line")
      .attr("class", "local-link")
      .attr("stroke", "#999").attr("stroke-width", 2)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead-local)");

    const linkLabel = svg.selectAll(".local-link-label").data(links).enter()
      .append("text")
      .attr("class", "local-link-label")
      .style("font-size", "10px").style("fill", "#555")
      .text(d => d.label);

    // --- 改变: 使用 <g> 元素来组合节点和标签，便于交互 ---
    const nodeGroup = svg.selectAll(".local-node-group").data(nodes).enter()
      .append("g")
      .attr("class", "local-node-group")
      .call(d3.drag() // 拖拽功能保持不变
          .on("start", (evt, d) => {
            if (!evt.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (evt, d) => { d.fx = evt.x; d.fy = evt.y; })
          .on("end", (evt, d) => {
            if (!evt.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          }));

    nodeGroup.append("circle")
      .attr("r", 12)
      .attr("fill", d => getColorForType(d.type))
      .attr("stroke", "#fff").attr("stroke-width", 1.5); // 新增白色描边，更有质感

    nodeGroup.append("text")
      .attr("class", "local-node-label")
      .style("font-size", "12px").style("fill", "#333")
      .attr("dy", -18) // 标签位置保持在节点上方
      .attr("text-anchor", "middle")
      .text(d => d.id);
      
    // --- 新增: 从 drawSocialNetwork 应用过来的交互高亮效果 ---
    nodeGroup
      .on("mouseover", function(event, d) {
        // 获取所有关联节点的ID
        const connectedIds = new Set([d.id]);
        links.forEach(l => {
          if (l.source.id === d.id) connectedIds.add(l.target.id);
          if (l.target.id === d.id) connectedIds.add(l.source.id);
        });

        // 弱化所有元素
        nodeGroup.style("opacity", 0.1);
        link.style("opacity", 0.1);
        linkLabel.style("opacity", 0.1);

        // 高亮显示选中的节点和其邻居
        nodeGroup.filter(n => connectedIds.has(n.id)).style("opacity", 1);
        
        // 高亮显示相关的连接线和标签
        link.filter(l => connectedIds.has(l.source.id) && connectedIds.has(l.target.id))
            .style("opacity", 1)
            .attr("stroke", "#555"); // 可以加粗或改变颜色

        linkLabel.filter(l => l.source.id === d.id || l.target.id === d.id)
            .style("opacity", 1)
            .style("font-weight", "bold");
      })
      .on("mouseout", function() {
        // 恢复所有元素的默认样式
        nodeGroup.style("opacity", 1);
        link.style("opacity", 1).attr("stroke", "#999");
        linkLabel.style("opacity", 1).style("font-weight", "normal");
      });

    function ticked() {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      linkLabel
        .attr("x", d => (d.source.x + d.target.x) / 2)
        .attr("y", d => (d.source.y + d.target.y) / 2);

      // --- 改变: 更新整个组的位置 ---
      nodeGroup.attr("transform", d => `translate(${d.x}, ${d.y})`);
    }
  }
  
function openEnlargedEventNetwork(ev) {
    const overlay = document.getElementById("event-network-lightbox");
    overlay.classList.remove("hidden");

    const closeBtn = document.getElementById("event-network-close");
    closeBtn.onclick = () => {
      overlay.classList.add("hidden");
      d3.select("#event-network-zoomed-container").selectAll("*").remove();
    };

    const titleEl = document.getElementById("event-network-title");
    titleEl.textContent = ev.title || "Event Network (Enlarged)";

    const container = d3.select("#event-network-zoomed-container");
    container.selectAll("*").remove();

    const w = container.node().clientWidth;
    const h = container.node().clientHeight;

    const svg = container.append("svg")
      .attr("width", w).attr("height", h)
      .style("background", "#fdfdfd"); // 使用柔和的背景色

    const zoomContainer = svg.append("g");

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrowEnlarge")
      .attr("markerWidth", 10).attr("markerHeight", 10)
      .attr("refX", 24) // --- 改变: 调整 refX 以适应更大的节点半径和描边 ---
      .attr("refY", 3)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L0,6 L9,3 z").attr("fill", "#888");

    if (!ev.networkPairs || ev.networkPairs.length === 0) {
      // (代码无变化)
    }

    // --- 数据处理部分 (代码无变化) ---
    const nodeNames = new Set();
    ev.networkPairs.forEach((pair) => {
      nodeNames.add(pair.source);
      nodeNames.add(pair.target);
    });
    const nodes = Array.from(nodeNames).map((name) => {
      const found = ev.participants?.find((pt) => pt.name === name);
      const t = found ? found.type : "person";
      return { id: name, type: t };
    });
    const links = ev.networkPairs.map((pair) => ({
      source: pair.source,
      target: pair.target,
      label: pair.label || "",
    }));

    // --- 核心: 力导向布局和缩放功能保持不变 ---
    const sim = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-250)) // 可以稍微增强排斥力
      .force("link", d3.forceLink(links).id((d) => d.id).distance(130))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .on("tick", ticked);

    const link = zoomContainer.selectAll(".enlarged-link").data(links).enter()
      .append("line")
      .attr("class", "enlarged-link")
      .attr("stroke", "#999").attr("stroke-width", 2)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowEnlarge)");

    const linkLabel = zoomContainer.selectAll(".enlarged-link-label").data(links).enter()
      .append("text")
      .attr("class", "enlarged-link-label")
      .style("font-size", "11px").style("fill", "#555")
      .style("pointer-events", "none") // 标签不干扰鼠标事件
      .text((d) => d.label);

    // --- 改变: 使用 <g> 元素来组合节点和标签，便于交互 ---
    const nodeGroup = zoomContainer.selectAll(".enlarged-node-group").data(nodes).enter()
      .append("g")
      .attr("class", "enlarged-node-group")
      .style("cursor", "pointer") // 改变鼠标样式
      .call(d3.drag() // 拖拽功能保持不变
          .on("start", (evt, d) => {
            if (!evt.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (evt, d) => { d.fx = evt.x; d.fy = evt.y; })
          .on("end", (evt, d) => {
            if (!evt.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          }));

    nodeGroup.append("circle")
      .attr("r", 14)
      .attr("fill", (d) => getColorForType(d.type))
      .attr("stroke", "#fff").attr("stroke-width", 2); // 新增白色描边，提升质感

    nodeGroup.append("text")
      .attr("class", "enlarged-node-label")
      .style("font-size", "12px").style("fill", "#333")
      .style("pointer-events", "none")
      .attr("text-anchor", "middle")
      .attr("dy", -20) // 调整标签位置
      .text((d) => d.id);

    // --- 新增: 从 drawSocialNetwork 应用过来的交互高亮效果 ---
    nodeGroup
      .on("mouseover", function(event, d) {
        const connectedIds = new Set([d.id]);
        links.forEach(l => {
          if (l.source.id === d.id) connectedIds.add(l.target.id);
          if (l.target.id === d.id) connectedIds.add(l.source.id);
        });

        // 弱化所有元素
        link.style("opacity", 0.1);
        linkLabel.style("opacity", 0.1);
        nodeGroup.style("opacity", 0.15);

        // 高亮相关元素
        nodeGroup.filter(n => connectedIds.has(n.id)).style("opacity", 1);
        link.filter(l => connectedIds.has(l.source.id) && connectedIds.has(l.target.id))
            .style("opacity", 1).attr("stroke", "#333");
        linkLabel.filter(l => l.source.id === d.id || l.target.id === d.id)
            .style("opacity", 1).style("font-weight", "bold");
      })
      .on("mouseout", function() {
        // 恢复所有元素的默认样式
        nodeGroup.style("opacity", 1);
        link.style("opacity", 1).attr("stroke", "#999");
        linkLabel.style("opacity", 1).style("font-weight", "normal");
      });

    const zoom = d3.zoom().scaleExtent([0.3, 8]).on("zoom", (event) => {
        zoomContainer.attr("transform", event.transform);
    });
    svg.call(zoom);

    function ticked() {
      link
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);

      linkLabel
        .attr("x", d => (d.source.x + d.target.x) / 2)
        .attr("y", d => (d.source.y + d.target.y) / 2);

      // --- 改变: 只需更新整个组的位置，代码更简洁 ---
      nodeGroup.attr("transform", d => `translate(${d.x}, ${d.y})`);
    }
  }
  
  function getColorForType(t) {
    switch (t.toLowerCase()) {
      case "place": return "#ffa500";
      case "museum": return "#ffff00";
      case "institution": return "#800080";
      case "greenperson": return "#008000";
      default: return "#1e90ff";
    }
  }

// ====================================================================
  //  START: Social Network Section (用这个替换你原来的整个代码块)
  // ====================================================================

  // 1. 这是您修改后的、更灵活的绘图函数
  // 它现在接受一个 'container' 参数来指定在哪里绘图
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
  
  // --- 移除: 删除根据连接数计算节点大小的逻辑 ---
  // const degreeMap = {};
  // socialNetworkData.nodes.forEach((n) => { degreeMap[n.id] = 0; });
  // socialNetworkData.edges.forEach((e) => { degreeMap[e.source] += 1; degreeMap[e.target] += 1; });
  // const sizeScale = d3.scaleLinear().domain([0, d3.max(Object.values(degreeMap))]).range([8, 24]);
  
  // --- 新增: 定义一个固定的节点半径 ---
  const fixedNodeRadius = 12; // 你可以根据喜好调整这个数值，比如 10 或 15

  // --- 更新: 为所有节点应用固定的半径 ---
  const nodes = socialNetworkData.nodes.map((d) => Object.assign({}, d, { radius: fixedNodeRadius }));
  const links = socialNetworkData.edges.map((d) => Object.assign({}, d));

  const radius = Math.min(w, h) / 2 - 120;
  const centerX = w / 2;
  const centerY = h / 2;
  const angleStep = (2 * Math.PI) / nodes.length;

  nodes.forEach((node, i) => {
    const angle = i * angleStep;
    node.x = centerX + radius * Math.cos(angle);
    node.y = centerY + radius * Math.sin(angle);
  });
  
  const linksWithCoords = links.map(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);
      return { source: sourceNode, target: targetNode, relationship: link.relationship };
  });

  const link = zoomContainer.selectAll(".social-link").data(linksWithCoords).enter().append("line")
      .attr("class", "social-link")
      .attr("stroke", "#bbb").attr("stroke-width", 1.5)
      .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x).attr("y2", d => d.target.y);

  const linkLabel = zoomContainer.selectAll(".social-link-label").data(linksWithCoords).enter().append("text")
      .attr("class", "social-link-label")
      .text(d => d.relationship)
      .attr("x", d => (d.source.x + d.target.x) / 2).attr("y", d => (d.source.y + d.target.y) / 2)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial, sans-serif").style("font-size", "10px").style("font-weight", "normal")
      .style("fill", "#666").style("pointer-events", "none")
      .style("paint-order", "stroke").style("stroke", "white").style("stroke-width", "2px");

  const node = zoomContainer.selectAll(".social-node").data(nodes).enter().append("g")
      .attr("class", "social-node-group")
      .attr("transform", d => `translate(${d.x},${d.y})`);

  node.append("circle")
      .attr("r", (d) => d.radius) // 这里仍然使用 d.radius，但现在所有节点的 d.radius 都是一样的
      .attr("fill", (d) => getColorForType(d.type))
      .attr("stroke", "#fff").attr("stroke-width", 1.5);
      
  linkLabel.raise();

  const nodeLabel = zoomContainer.selectAll(".node-label-group").data(nodes).enter().append("text")
      .attr("class", "social-node-label")
      .text(d => d.id)
      .style("font-size", "12px").style("font-weight", "500")
      .style("fill", "#333").style("pointer-events", "none")
      .attr("text-anchor", (d, i) => {
        const angle = i * angleStep;
        return angle > Math.PI / 2 && angle < Math.PI * 1.5 ? "end" : "start";
      })
      .attr("dominant-baseline", "middle")
      .attr("x", (d, i) => {
        const angle = i * angleStep;
        const offset = d.radius + 8;
        return d.x + offset * Math.cos(angle);
      })
      .attr("y", (d, i) => {
        const angle = i * angleStep;
        const offset = d.radius + 8;
        return d.y + offset * Math.sin(angle);
      });
  
  const nodeGroups = zoomContainer.selectAll(".social-node-group");
  nodeGroups
      .on("mouseover", function(event, d) {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`<strong>${d.id}</strong><br/>${d.bio}`).style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 28}px`);
        
        const connectedIds = new Set();
        connectedIds.add(d.id);
        links.forEach(l => {
          if (l.source === d.id) connectedIds.add(l.target);
          if (l.target === d.id) connectedIds.add(l.source);
        });

        link.style("opacity", 0.1);
        nodeGroups.style("opacity", 0.1);
        nodeLabel.style("opacity", 0.1);
        linkLabel.style("opacity", 0.1);

        nodeGroups.filter(n => connectedIds.has(n.id)).style("opacity", 1);
        nodeLabel.filter(n => connectedIds.has(n.id)).style("opacity", 1).raise();
        link.filter(l => connectedIds.has(l.source.id) && connectedIds.has(l.target.id)).style("opacity", 1);
        
        linkLabel.filter(l => l.source.id === d.id || l.target.id === d.id)
            .style("opacity", 1)
            .style("font-size", "13px")
            .style("font-weight", "bold")
            .raise();
      })
      .on("mousemove", (event) => { 
        tooltip.style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 28}px`); 
      })
      .on("mouseout", function() {
        tooltip.transition().duration(300).style("opacity", 0);

        nodeGroups.style("opacity", 1);
        link.style("opacity", 1);
        nodeLabel.style("opacity", 1);
        
        linkLabel
            .style("opacity", 1)
            .style("font-size", "10px")
            .style("font-weight", "normal");
      });

  const zoom = d3.zoom().scaleExtent([0.3, 10]).on("zoom", (event) => { 
      zoomContainer.attr("transform", event.transform); 
  });
  svg.call(zoom);

  d3.select("#reset-zoom-btn").on("click", () => {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
  });
}
  // 2. 这部分代码将在页面加载时，直接调用上面的函数进行绘图
  if (socialNetworkData) {
    const onPageContainer = d3.select("#social-network-container .placeholder-content");
    // 确保容器存在
    if (!onPageContainer.empty()) {
        const w = onPageContainer.node().clientWidth;
        const h = onPageContainer.node().clientHeight;
        // 调用绘图函数，并把主页的容器传给它
        console.log("Drawing social network in on-page container with size:", w, h);
        drawSocialNetwork(onPageContainer, w, h);
    }
  }
  
  // ====================================================================
  //  END: Social Network Section
  // ====================================================================
  // Auto-load the first event into the static section
  renderInteractiveProvenanceD3(provenanceTimeline, provenanceEvents, openEventModal);

  if (provenanceEvents.length > 0) {
    openEventModal(0);
  }
}
/** Utility: remove extension from image URL */
function getFilenameBase(url) {
  const parts = url.split("/");
  const filename = parts[parts.length - 1];
  return filename.replace(/\.[^.]+$/, "");
}

/** Lightbox for images (vertical & centered) */
function openImageLightbox(imgSrc, sourceHTML) {
  const lb = document.getElementById("image-lightbox");
  const lbImg = document.getElementById("lightbox-img");
  lbImg.src = imgSrc;

  const lbText = document.getElementById("lightbox-text");
  if (sourceHTML) {
    lbText.innerHTML = sourceHTML;
    lbText.style.display = "block";
  } else {
    lbText.style.display = "none";
  }

  lb.classList.remove("hidden");
}

function closeImageLightbox() {
  document.getElementById("image-lightbox").classList.add("hidden");
}

/** "Back to Gallery" button */
document
  .getElementById("back-to-gallery")
  ?.addEventListener("click", () => (window.location.href = "index.html"));

/** Lightbox close for images */
document
  .getElementById("lightbox-close")
  ?.addEventListener("click", closeImageLightbox);

/********************************************
 * IIFE: load correct JSON from ?id
 ********************************************/
(async function () {
  const params = new URLSearchParams(window.location.search);
  const artworkId = params.get("id");
  if (!artworkId) {
    alert("No artwork ID provided in the URL.");
    return;
  }

  const dataFile = `data/${artworkId}.json`;

  try {
    const resp = await fetch(dataFile);
    const json = await resp.json();
    await initProvenance(json);
  } catch (err) {
    console.error("Could not load JSON for artwork:", err);
    alert("Error loading artwork data. Check console for details.");
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  // The modal and close button
  const instructionsModal = document.getElementById("instructions-modal");
  const instructionsClose = document.getElementById("instructions-close");

  // The floating icon in bottom-right
  const instructionsIcon = document.getElementById("instructions-icon");

  // 1) Show the Instructions modal automatically on page load
  // instructionsIcon.classList.add("hidden");
  // instructionsModal.classList.remove("hidden");

  // 2) If user clicks the close [x] inside the modal
  instructionsClose.addEventListener("click", () => {
    instructionsIcon.classList.remove("hidden");
    instructionsModal.classList.add("hidden");

  });

  // 3) The user can always re-open instructions by clicking the icon
  instructionsIcon.addEventListener("click", () => {
    instructionsModal.classList.remove("hidden");
    instructionsIcon.classList.add("hidden");
  });
});


/**
 * Renders an interactive provenance text block and a modern, horizontal timeline with scroll controls using D3.js.
 * @param {object} provenanceTimeline The 'provenanceTimeline' object from the JSON data.
 * @param {Array} provenanceEvents The 'provenanceEvents' array from the JSON data.
 * @param {Function} eventHandlerCallback A function to call when an interactive element is clicked, e.g., openEventModal.
 */
function renderInteractiveProvenanceD3(provenanceTimeline, provenanceEvents, eventHandlerCallback) {
  // --- 1. Get Containers & Validate Data ---
  const provenanceContainer = d3.select("#story-div-placeholder");
  const timelineContainer = d3.select("#timeline-placeholder").attr('class', 'timeline-container');

  if (!provenanceTimeline || !provenanceEvents || provenanceContainer.empty() || timelineContainer.empty()) {
    provenanceContainer.style('display', 'none');
    timelineContainer.style('display', 'none');
    console.warn("Provenance data or HTML placeholders are missing.");
    return;
  }
  
  provenanceContainer.style('display', 'block').html('<h2>Provenance</h2>');

  // --- 2. Dynamic Link Map ---
  const entryToStoryMap = {};
  provenanceTimeline.entries.forEach(entry => {
    const ownerName = entry.owner.toLowerCase();
    const relatedStoryIds = new Set();
    provenanceEvents.forEach(story => {
      if (story.participants.some(p => ownerName.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(ownerName))) {
        relatedStoryIds.add(story.id);
      }
    });
    if (relatedStoryIds.size > 0) entryToStoryMap[entry.id] = Array.from(relatedStoryIds);
  });

  // --- 3. Render Provenance Text using D3 ---
  const provenanceParagraph = provenanceContainer.append('p');
  provenanceParagraph.selectAll('span.provenance-entry')
    .data(provenanceTimeline.entries).enter().append('span')
    .attr('class', 'provenance-entry').style('cursor', d => (entryToStoryMap[d.id] ? 'pointer' : 'default'))
    .attr('data-story-ids', d => (entryToStoryMap[d.id] ? JSON.stringify(entryToStoryMap[d.id]) : null))
    .text(d => d.fullText + ' ').on('click', function(event, d) {
      const storyIds = entryToStoryMap[d.id];
      if (storyIds && storyIds.length > 0) eventHandlerCallback(storyIds[0]);
    });

  // --- 4. Render Horizontal Timeline & Scroll Buttons using D3 ---
  const timelineWrapper = timelineContainer.append('div').attr('class', 'timeline-wrapper');
  const timelineEl = timelineWrapper.append('div').attr('class', 'timeline')
      .style('min-width', `${provenanceTimeline.events.length * 180}px`);

  const timelineItems = timelineEl.selectAll('.timeline-item').data(provenanceTimeline.events).enter().append('div')
      .attr('class', 'timeline-item').attr('data-story-id', d => d.storyId)
      .on('click', function(event, d) {
        if (d.storyId !== null) eventHandlerCallback(d.storyId);
      });

  // Append elements in order
  timelineItems.append('div').attr('class', 'timeline-content')
      .append('div').attr('class', 'timeline-event').text(d => d.event);
      
  timelineItems.append('div').attr('class', 'timeline-point');

  // NEW: Append date label separately
  timelineItems.append('div').attr('class', 'timeline-date-label').text(d => d.date);

  // --- 5. Add Scroll Controls ---
  const prevBtn = timelineContainer.append('button').attr('id', 'timeline-scroll-prev').attr('class', 'timeline-scroll-btn')
      .html('<span class="arrow">&#x2039;</span><span class="nav-text">Prev</span>');
  const nextBtn = timelineContainer.append('button').attr('id', 'timeline-scroll-next').attr('class', 'timeline-scroll-btn')
      .html('<span class="nav-text">Next</span><span class="arrow">&#x203A;</span>');
  
  function updateScrollButtons() {
    const el = timelineWrapper.node();
    prevBtn.classed('hidden', el.scrollLeft <= 2);
    nextBtn.classed('hidden', el.scrollLeft >= el.scrollWidth - el.clientWidth - 2);
  }

  prevBtn.on('click', () => timelineWrapper.node().scrollBy({ left: -360, behavior: 'smooth' }));
  nextBtn.on('click', () => timelineWrapper.node().scrollBy({ left: 360, behavior: 'smooth' }));
  timelineWrapper.on('scroll', updateScrollButtons);
  
  new ResizeObserver(updateScrollButtons).observe(timelineWrapper.node());
  setTimeout(updateScrollButtons, 100);
}