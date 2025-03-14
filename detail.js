async function initProvenance(json) {
  // 1. Deconstruct
  const artworkData = json.artworkData;
  const placeData = json.placeData;
  const provenanceEvents = json.provenanceEvents;
  const socialNetworkData = json.socialNetwork || null;

  // 2. Top info
  document.getElementById("artwork-title").textContent = artworkData.title;
  const artImg = document.getElementById("artwork-image");
  artImg.src = artworkData.imageUrl;
  artImg.alt = artworkData.description || "Art Image";
  document.getElementById("artwork-description").innerHTML =
    artworkData.description;

  // 3. Leaflet map, no fixed center
  const map = L.map("map");
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
  }).addTo(map);

  const placeCounts = {};
  let lastLocation = null;

  /************************************
   * Build lines from networkPairs
   ************************************/
  provenanceEvents.forEach((ev, index) => {
    ev.singlePlace = null;
    if (ev.changedLocation) {
      const pairs = ev.networkPairs || [];
      let finalLoc = ev.to;

      // lines for each pair
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

      // If from!=to, draw extra line
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
      // changedLocation=false => same place
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

  /************************************
   * Create map markers + fit
   ************************************/
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
      const badge = L.divIcon({
        className: "map-badge",
        html: count,
      });
      L.marker(info.coords, { icon: badge, interactive: false }).addTo(map);
    }

    // relevant
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
  if (allCoords.length > 0) {
    const bounds = L.latLngBounds(allCoords);
    map.fitBounds(bounds, { padding: [50, 50] });
  } else {
    map.setView([48.8566, 2.3522], 5);
  }

  /************************************
   * Single event overlay
   ************************************/
  let currentIndex = 0;
  let currentEventData = null;

  const overlay = document.getElementById("map-overlay");
  const overlayClose = document.getElementById("overlay-close");
  const eventTitleEl = document.getElementById("overlay-event-title");
  const eventThumbEl = document.getElementById("overlay-artwork-thumb");
  const eventTextEl = document.getElementById("overlay-event-text");
  // const eventNameEl = document.getElementById("overlay-artwork-name");
  const sourceDiv = document.getElementById("overlay-image-source") || null;

  const prevBtn = document.getElementById("prev-event");
  const nextBtn = document.getElementById("next-event");
  const magnifyBtn = document.getElementById("magnify-event-network");

  function openEventModal(idx) {
    if (idx < 0 || idx >= provenanceEvents.length) return;
    currentIndex = idx;
    overlay.classList.remove("hidden");

    prevBtn.style.display = currentIndex === 0 ? "none" : "inline-block";
    nextBtn.style.display =
      currentIndex === provenanceEvents.length - 1 ? "none" : "inline-block";

    const ev = provenanceEvents[idx];
    currentEventData = ev;

    eventTitleEl.textContent = ev.title;
    eventTextEl.innerHTML = `<p>${ev.text}</p>`;
    // eventNameEl.textContent = artworkData.title;

    // event image
    const sanitizedBase = getFilenameBase(artworkData.imageUrl);
    const eventImgUrl = `assets/${sanitizedBase}-${ev.id}.jpg`;

    eventThumbEl.style.display = "block";
    const altText = ev.imageAlt || "Event Image";
    eventThumbEl.alt = altText;
    eventThumbEl.onerror = () => {
      eventThumbEl.style.display = "none";
    };
    eventThumbEl.src = eventImgUrl;

    // image source
    if (sourceDiv && ev.imageSource) {
      sourceDiv.innerHTML = ev.imageSource;
      sourceDiv.style.display = "block";
    } else if (sourceDiv) {
      sourceDiv.style.display = "none";
    }

    drawNetworkForEvent(ev);
  }

  function closeOverlay() {
    overlay.classList.add("hidden");
    d3.select("#overlay-network").selectAll("*").remove();
  }
  overlayClose.addEventListener("click", closeOverlay);

  prevBtn.addEventListener("click", () => {
    let newI = currentIndex - 1;
    if (newI < 0) newI = 0;
    openEventModal(newI);
  });
  nextBtn.addEventListener("click", () => {
    let newI = currentIndex + 1;
    if (newI >= provenanceEvents.length) newI = provenanceEvents.length - 1;
    openEventModal(newI);
  });

  // If user clicks the event image -> open lightbox
  eventThumbEl.addEventListener("click", () => {
    if (!currentEventData) return;
    openImageLightbox(eventThumbEl.src, currentEventData.imageSource || "");
  });

  // The "four arrow" enlarge button
  magnifyBtn.addEventListener("click", () => {
    if (!currentEventData) return;
    openEnlargedEventNetwork(currentEventData);
  });

  /************************************
   * drawNetworkForEvent (small local)
   ************************************/
  function drawNetworkForEvent(ev) {
    const container = d3.select("#overlay-network");
    container.selectAll("svg").remove();

    const parent = document.querySelector(".col-middle");
    if (!parent) {
        console.error("Parent container `.col-middle` not found!");
        return;
    }

    const w = parent.clientWidth-32;
    const h = parent.clientHeight-32;

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


  function renderLocalNetwork(svg, w, h, ev) {
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrowhead-local")
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("refX", 14)
      .attr("refY", 3)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L0,6 L9,3 z")
      .attr("fill", "#999");

    if (!ev.networkPairs || ev.networkPairs.length === 0) {
      svg
        .append("text")
        .attr("x", 20)
        .attr("y", 20)
        .text("No movement or no networkPairs.")
        .style("font-size", "14px");
      return;
    }

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

    const sim = d3
      .forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-200))
      .force("link", d3.forceLink(links).id((d) => d.id).distance(120))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .on("tick", ticked);

    const link = svg
      .selectAll(".local-link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "local-link")
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead-local)");

    const linkLabel = svg
      .selectAll(".local-link-label")
      .data(links)
      .enter()
      .append("text")
      .attr("class", "local-link-label")
      .text((d) => d.label);

    const node = svg
      .selectAll(".local-node")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("class", "local-node")
      .attr("r", 12)
      .attr("fill", (d) => getColorForType(d.type))
      .call(
        d3
          .drag()
          .on("start", (evt, d) => {
            if (!evt.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (evt, d) => {
            d.fx = evt.x;
            d.fy = evt.y;
          })
          .on("end", (evt, d) => {
            if (!evt.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const nodeLabel = svg
      .selectAll(".local-node-label")
      .data(nodes)
      .enter()
      .append("text")
      .attr("class", "local-node-label")
      .style("font-size", "12px")
      .style("fill", "#333")
      .text((d) => d.id);

    function ticked() {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      linkLabel
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      nodeLabel.attr("x", (d) => d.x).attr("y", (d) => d.y - 18);
    }
  }

  /************************************
   * Enlarge local event network (zoom)
   ************************************/
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

    // We already set style in HTML: 80vw x 70vh
    const w = container.node().clientWidth;
    const h = container.node().clientHeight;

    const svg = container
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px");

    const zoomContainer = svg.append("g");

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrowEnlarge")
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("refX", 14)
      .attr("refY", 3)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L0,6 L9,3 z")
      .attr("fill", "#999");

    if (!ev.networkPairs || ev.networkPairs.length === 0) {
      zoomContainer
        .append("text")
        .attr("x", 20)
        .attr("y", 20)
        .text("No movement or no networkPairs.")
        .style("font-size", "14px");
      return;
    }

    // Build data
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

    const sim = d3
      .forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-200))
      .force("link", d3.forceLink(links).id((d) => d.id).distance(130))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .on("tick", ticked);

    const link = zoomContainer
      .selectAll(".enlarged-link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "enlarged-link")
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowEnlarge)");

    const linkLabel = zoomContainer
      .selectAll(".enlarged-link-label")
      .data(links)
      .enter()
      .append("text")
      .attr("class", "enlarged-link-label")
      .text((d) => d.label);

    const node = zoomContainer
      .selectAll(".enlarged-node")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("class", "enlarged-node")
      .attr("r", 14)
      .attr("fill", (d) => getColorForType(d.type))
      .call(
        d3
          .drag()
          .on("start", (evt, d) => {
            if (!evt.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (evt, d) => {
            d.fx = evt.x;
            d.fy = evt.y;
          })
          .on("end", (evt, d) => {
            if (!evt.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const nodeLabel = zoomContainer
      .selectAll(".enlarged-node-label")
      .data(nodes)
      .enter()
      .append("text")
      .attr("class", "enlarged-node-label")
      .style("font-size", "12px")
      .style("fill", "#333")
      .text((d) => d.id);

    // Zoom/pan
    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        zoomContainer.attr("transform", event.transform);
      });
    svg.call(zoom);

    function ticked() {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      linkLabel
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      nodeLabel.attr("x", (d) => d.x).attr("y", (d) => d.y - 18);
    }
  }

  function getColorForType(t) {
    switch (t.toLowerCase()) {
      case "place":
        return "#ffa500";
      case "museum":
        return "#ffff00";
      case "institution":
        return "#800080";
      case "greenperson":
        return "#008000";
      default:
        return "#1e90ff";
    }
  }

  /************************************
   * Full network overlay
   ************************************/
  const showFullBtn = document.getElementById("show-full-network");
  if (showFullBtn) {
    const fullOverlay = document.getElementById("full-network-overlay");
    const fullClose = document.getElementById("full-network-close");
    const fullDiagram = d3.select("#full-network-diagram");
    const fullTitle = document.getElementById("full-network-title");

    showFullBtn.addEventListener("click", () => {
      fullOverlay.classList.remove("hidden");
      const w = fullDiagram.node().clientWidth;
      const h = fullDiagram.node().clientHeight;
      fullTitle.textContent = `Full Provenance Network for ${artworkData.title}`;
      drawFullNetwork(w, h);
    });

    fullClose.addEventListener("click", () => {
      fullOverlay.classList.add("hidden");
      fullDiagram.selectAll("*").remove();
    });

    function drawFullNetwork(w, h) {
      fullDiagram.selectAll("*").remove();

      const width = w,
        height = 2 * h;
      const svg = fullDiagram
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      const zoomContainer = svg.append("g");

      const defs = svg.append("defs");
      defs
        .append("marker")
        .attr("id", "arrowFull")
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .attr("refX", 14)
        .attr("refY", 3)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L0,6 L9,3 z")
        .attr("fill", "#999");

      // gather edges & name->type
      const edges = [];
      const nameToType = {};
      provenanceEvents.forEach((ev) => {
        if (ev.participants) {
          ev.participants.forEach((pt) => {
            nameToType[pt.name] = pt.type;
          });
        }
        if (ev.networkPairs) {
          ev.networkPairs.forEach((pair) => {
            edges.push({
              source: pair.source,
              target: pair.target,
              label: pair.label || "",
            });
            if (!nameToType[pair.source]) nameToType[pair.source] = "person";
            if (!nameToType[pair.target]) nameToType[pair.target] = "person";
          });
        }
      });

      const nodeSet = new Set();
      edges.forEach((e) => {
        nodeSet.add(e.source);
        nodeSet.add(e.target);
      });
      const nodes = Array.from(nodeSet).map((n) => {
        const t = nameToType[n] || "person";
        return { id: n, type: t };
      });

      const sim = d3
        .forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(-250))
        .force("link", d3.forceLink(edges).id((d) => d.id).distance(130))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .on("tick", ticked);

      const link = zoomContainer
        .selectAll(".link")
        .data(edges)
        .enter()
        .append("line")
        .attr("class", "link")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowFull)");

      const linkLabel = zoomContainer
        .selectAll(".link-label")
        .data(edges)
        .enter()
        .append("text")
        .attr("class", "link-label")
        .text((d) => d.label);

      const node = zoomContainer
        .selectAll(".node")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", 14)
        .attr("fill", (d) => getColorForType(d.type))
        .call(
          d3
            .drag()
            .on("start", (event, d) => {
              if (!event.active) sim.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event, d) => {
              if (!event.active) sim.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        );

      const nodeLabel = zoomContainer
        .selectAll(".node-label")
        .data(nodes)
        .enter()
        .append("text")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text((d) => d.id);

      const zoom = d3
        .zoom()
        .scaleExtent([0.5, 5])
        .on("zoom", (event) => {
          zoomContainer.attr("transform", event.transform);
        });
      svg.call(zoom);

      function ticked() {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        linkLabel
          .attr("x", (d) => (d.source.x + d.target.x) / 2)
          .attr("y", (d) => (d.source.y + d.target.y) / 2);

        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        nodeLabel.attr("x", (d) => d.x).attr("y", (d) => d.y - 18);
      }
    }
  }

  /************************************
   * Social Network overlay with zoom
   ************************************/
  const showSocialBtn = document.getElementById("show-social-network");
  if (showSocialBtn && socialNetworkData) {
    const socialOverlay = document.getElementById("social-network-overlay");
    const socialClose = document.getElementById("social-network-close");
    const socialDiagram = d3.select("#social-network-diagram");

    showSocialBtn.addEventListener("click", () => {
      socialOverlay.classList.remove("hidden");
      const w = socialDiagram.node().clientWidth || 400;
      const h = socialDiagram.node().clientHeight || 300;
      drawSocialNetwork(w, h);
    });

    socialClose.addEventListener("click", () => {
      socialOverlay.classList.add("hidden");
      socialDiagram.selectAll("*").remove();
      d3.select("#tooltip").remove();
    });

    function drawSocialNetwork(w, h) {
      socialDiagram.selectAll("*").remove();

      const tooltip = d3
        .select("body")
        .append("div")
        .attr("id", "tooltip")
        .style("position", "absolute")
        .style("padding", "8px")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "#fff")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "12px")
        .style("opacity", 0);

      const svg = socialDiagram
        .append("svg")
        .attr("width", w)
        .attr("height", h)
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("border-radius", "8px");

      const zoomContainer = svg.append("g");

      const defs = svg.append("defs");
      defs
        .append("marker")
        .attr("id", "arrowSocial")
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .attr("refX", 14)
        .attr("refY", 3)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L0,6 L9,3 z")
        .attr("fill", "#666");

      const degreeMap = {};
      socialNetworkData.nodes.forEach((n) => {
        degreeMap[n.id] = 0;
      });
      socialNetworkData.edges.forEach((e) => {
        degreeMap[e.source] += 1;
        degreeMap[e.target] += 1;
      });

      const sizeScale = d3
        .scaleLinear()
        .domain([0, d3.max(Object.values(degreeMap))])
        .range([12, 30]);

      const nodes = socialNetworkData.nodes.map((d) =>
        Object.assign({}, d, { radius: sizeScale(degreeMap[d.id]) })
      );
      const links = socialNetworkData.edges.map((d) => Object.assign({}, d));

      const simulation = d3
        .forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(-200))
        .force("link", d3.forceLink(links).id((d) => d.id).distance(150))
        .force("center", d3.forceCenter(w / 2, h / 2))
        .on("tick", ticked);

      const link = zoomContainer
        .selectAll(".social-link")
        .data(links)
        .enter()
        .append("line")
        .attr("class", "social-link")
        .attr("stroke", "#777")
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowSocial)");

      const linkLabel = zoomContainer
        .selectAll(".social-link-label")
        .data(links)
        .enter()
        .append("text")
        .attr("class", "social-link-label")
        .text((d) => d.relationship)
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "15px")
        .style("fill", "#555");

      const node = zoomContainer
        .selectAll(".social-node")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("class", "social-node")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => getColorForType(d.type))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .call(
          d3
            .drag()
            .on("start", (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        )
        .on("mouseover", (event, d) => {
          tooltip.transition().duration(200).style("opacity", 0.9);
          tooltip
            .html("<strong>" + d.id + "</strong><br/>" + d.bio)
            .style("left", event.pageX + 10 + "px")
            .style("width", "30vw")
            .style("z-index", "10001")
            .style("top", event.pageY - 28 + "px");
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", () => {
          tooltip.transition().duration(300).style("opacity", 0);
        });

      const nodeLabel = zoomContainer
        .selectAll(".social-node-label")
        .data(nodes)
        .enter()
        .append("text")
        .attr("class", "social-node-label")
        .text((d) => d.id)
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "12px")
        .style("fill", "#333");

      const zoom = d3
        .zoom()
        .scaleExtent([0.5, 5])
        .on("zoom", (event) => {
          zoomContainer.attr("transform", event.transform);
        });
      svg.call(zoom);

      function ticked() {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        linkLabel
          .attr("x", (d) => (d.source.x + d.target.x) / 2)
          .attr("y", (d) => (d.source.y + d.target.y) / 2);

        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        nodeLabel.attr("x", (d) => d.x).attr("y", (d) => d.y - d.radius - 5);
      }
    }
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
  instructionsIcon.classList.add("hidden");
  instructionsModal.classList.remove("hidden");

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
