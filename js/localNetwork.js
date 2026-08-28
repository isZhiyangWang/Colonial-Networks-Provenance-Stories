import { $, setText } from "./utils.js";

function getColorForType(t = "") {
  switch (t.toLowerCase()) {
    case "museum": return "#ffff00";
    case "greenperson": return "#008000";
    default: return "#636363ff";
  }
}

function wrapLabel(text, maxChars = 18) {
  const tokens = String(text || "").replace(/-/g, "- ").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  tokens.forEach((token) => {
    const separator = line && !line.endsWith("-") ? " " : "";
    const candidate = `${line}${separator}${token}`;
    if (line && candidate.length > maxChars) {
      lines.push(line);
      line = token;
    } else {
      line = candidate;
    }
  });

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function appendWrappedLabels(nodeGroup, className, maxChars = 18) {
  nodeGroup.append("text")
    .attr("class", className)
    .style("font-size", "12px")
    .style("fill", "#333")
    .style("pointer-events", "none")
    .attr("text-anchor", "middle")
    .each(function (d) {
      const lines = wrapLabel(d.id, maxChars);
      const firstDy = -18 - ((lines.length - 1) * 12);
      const text = d3.select(this);
      lines.forEach((line, index) => {
        text.append("tspan")
          .attr("x", 0)
          .attr("dy", index === 0 ? firstDy : 12)
          .text(line);
      });
    });
}

function addLayoutForces(simulation, nodes, w, h) {
  const compact = w < 520;
  const vertical = compact || h > w * 1.2;
  const count = Math.max(nodes.length, 1);
  const useCompactGrid = compact && count > 3;
  const compactRows = Math.ceil(count / 2);
  const targetX = (d) => {
    if (compact) return useCompactGrid ? w * (d.layoutIndex % 2 === 0 ? 0.3 : 0.7) : w * 0.5;
    return vertical
      ? w * (d.layoutIndex % 2 === 0 ? 0.34 : 0.66)
      : ((d.layoutIndex + 1) * w) / (count + 1);
  };
  const targetY = (d) => {
    if (compact) {
      const row = useCompactGrid ? Math.floor(d.layoutIndex / 2) : d.layoutIndex;
      const rowCount = useCompactGrid ? compactRows : count;
      return ((row + 1) * h) / (rowCount + 1);
    }
    return vertical
      ? ((d.layoutIndex + 1) * h) / (count + 1)
      : h * (d.layoutIndex % 2 === 0 ? 0.43 : 0.57);
  };

  simulation
    .force("x", d3.forceX(targetX).strength(compact ? 1 : 0.65))
    .force("y", d3.forceY(targetY).strength(compact ? 0.85 : 0.65))
    .force("collide", d3.forceCollide(compact ? 44 : vertical ? 42 : 58));

  if (compact) simulation.force("charge", d3.forceManyBody().strength(-50));

  return vertical;
}

function getLinkLabelPosition(link, offset = 0) {
  const x = (link.source.x + link.target.x) / 2;
  const y = (link.source.y + link.target.y) / 2;
  if (!offset) return { x, y };

  const dx = link.target.x - link.source.x;
  const dy = link.target.y - link.source.y;
  const length = Math.hypot(dx, dy) || 1;
  let normalX = -dy / length;
  let normalY = dx / length;

  if (Math.abs(dy) <= Math.abs(dx) * 0.35 && normalY < 0) {
    normalX *= -1;
    normalY *= -1;
  } else if (Math.abs(dx) < Math.abs(dy) && normalX > 0) {
    normalX *= -1;
    normalY *= -1;
  }

  const nearHorizontal = Math.abs(dy) <= Math.abs(dx) * 0.35;
  const horizontalShift = offset && nearHorizontal ? Math.sign(dx || 1) * 38 : 0;
  return {
    x: x + normalX * offset + horizontalShift,
    y: y + normalY * offset,
  };
}

function clampNodes(nodes, w, h, vertical) {
  const xPadding = vertical ? Math.min(70, w * 0.24) : 80;
  const yPaddingTop = 48;
  const yPaddingBottom = 32;
  nodes.forEach((d) => {
    d.x = Math.max(xPadding, Math.min(w - xPadding, d.x));
    d.y = Math.max(yPaddingTop, Math.min(h - yPaddingBottom, d.y));
  });
}

export function drawNetworkForEvent(ev) {
  const container = d3.select("#overlay-network");
  container.selectAll("svg").remove();

  const parent = document.querySelector(".col-middle");
  if (!parent) { console.error("Parent container `.col-middle` not found!"); return; }

  const compactLayout = window.matchMedia("(max-width: 900px)").matches;

  if (compactLayout) {
    const nodeNames = new Set();
    ev.networkPairs?.forEach((pair) => { nodeNames.add(pair.source); nodeNames.add(pair.target); });
    const rows = nodeNames.size > 3 ? Math.ceil(nodeNames.size / 2) : nodeNames.size;
    const compactHeight = rows > 2 ? rows * 130 + 80 : 320;
    parent.style.height = `${compactHeight}px`;
    parent.style.minHeight = `${compactHeight}px`;
  } else {
    parent.style.removeProperty("height");
    parent.style.removeProperty("min-height");
  }

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

  const nodes = Array.from(nodeNames).map((name, layoutIndex) => {
    const found = ev.participants?.find((pt) => pt.name === name);
    const t = found ? found.type : "person";
    return { id: name, type: t, layoutIndex };
  });

  const links = ev.networkPairs.map((pair) => ({ source: pair.source, target: pair.target, label: pair.label || "" }));

  const sim = d3.forceSimulation(nodes)
    .force("charge", d3.forceManyBody().strength(-140))
    .force("link", d3.forceLink(links).id((d) => d.id).distance(105));
  const verticalLayout = addLayoutForces(sim, nodes, w, h);
  sim.on("tick", ticked);

  const link = svg.selectAll(".local-link").data(links).enter()
    .append("line").attr("class", "local-link")
    .attr("stroke", "#999").attr("stroke-width", 2).attr("stroke-opacity", 0.6)
    .attr("marker-end", "url(#arrowhead-local)");

  const linkLabel = svg.selectAll(".local-link-label").data(links).enter()
    .append("text").attr("class", "local-link-label")
    .attr("text-anchor", "middle")
    .style("font-size", "10px").style("fill", "#555")
    .style("paint-order", "stroke").style("stroke", "#fff").style("stroke-width", "3px")
    .text((d) => d.label);

  const nodeGroup = svg.selectAll(".local-node-group").data(nodes).enter()
    .append("g").attr("class", "local-node-group")
    .call(d3.drag()
      .on("start", (evt, d) => { if (!evt.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (evt, d) => { d.fx = evt.x; d.fy = evt.y; })
      .on("end", (evt, d) => { if (!evt.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  const r = 12;
  nodeGroup.append("rect")
    .attr("x", -r).attr("y", -r)
    .attr("width", r * 2).attr("height", r * 2)
    .attr("rx", 2).attr("ry", 2)
    .attr("fill", (d) => getColorForType(d.type))
    .attr("stroke", "#4f4f4f").attr("stroke-opacity", 0.65).attr("stroke-width", 1.5);

  appendWrappedLabels(nodeGroup, "local-node-label");

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
    clampNodes(nodes, w, h, verticalLayout);
    link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
    linkLabel.attr("x", (d) => getLinkLabelPosition(d, w < 520 ? 36 : 0).x)
             .attr("y", (d) => getLinkLabelPosition(d, w < 520 ? 36 : 0).y);
    nodeGroup.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
  }

  // Settle before paint so the diagram appears in its final position.
  sim.stop();
  sim.tick(220);
  ticked();
}

export function openEnlargedEventNetwork(ev) {
  const overlay = document.getElementById("event-network-lightbox");
  const closeBtn = document.getElementById("event-network-close");
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
  const nodes = Array.from(nodeNames).map((name, layoutIndex) => {
    const found = ev.participants?.find((pt) => pt.name === name);
    return { id: name, type: found ? found.type : "person", layoutIndex };
  });
  const links = ev.networkPairs.map((pair) => ({ source: pair.source, target: pair.target, label: pair.label || "" }));

  const sim = d3.forceSimulation(nodes)
    .force("charge", d3.forceManyBody().strength(-180))
    .force("link", d3.forceLink(links).id((d) => d.id).distance(130));
  const verticalLayout = addLayoutForces(sim, nodes, w, h);
  sim.on("tick", ticked);

  const link = zoomContainer.selectAll(".enlarged-link").data(links).enter()
    .append("line").attr("class", "enlarged-link")
    .attr("stroke", "#999").attr("stroke-width", 2).attr("stroke-opacity", 0.6)
    .attr("marker-end", "url(#arrowEnlarge)");

  const linkLabel = zoomContainer.selectAll(".enlarged-link-label").data(links).enter()
    .append("text").attr("class", "enlarged-link-label")
    .attr("text-anchor", "middle")
    .style("font-size", "11px").style("fill", "#555").style("pointer-events", "none")
    .style("paint-order", "stroke").style("stroke", "#fff").style("stroke-width", "3px")
    .text((d) => d.label);

  const nodeGroup = zoomContainer.selectAll(".enlarged-node-group").data(nodes).enter()
    .append("g").attr("class", "enlarged-node-group").style("cursor", "pointer")
    .call(d3.drag()
      .on("start", (evt, d) => { if (!evt.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (evt, d) => { d.fx = evt.x; d.fy = evt.y; })
      .on("end", (evt, d) => { if (!evt.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  const rr = 14;
  nodeGroup.append("rect")
    .attr("x", -rr).attr("y", -rr)
    .attr("width", rr * 2).attr("height", rr * 2)
    .attr("rx", 2).attr("ry", 2)
    .attr("fill", (d) => getColorForType(d.type))
    .attr("stroke", "#4f4f4f").attr("stroke-opacity", 0.65).attr("stroke-width", 1.5);

  appendWrappedLabels(nodeGroup, "enlarged-node-label", 22);

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
    clampNodes(nodes, w, h, verticalLayout);
    link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
    linkLabel.attr("x", (d) => getLinkLabelPosition(d, w < 520 ? 38 : 0).x)
             .attr("y", (d) => getLinkLabelPosition(d, w < 520 ? 38 : 0).y);
    nodeGroup.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
  }


  sim.stop();
  sim.tick(260);
  ticked();
}
