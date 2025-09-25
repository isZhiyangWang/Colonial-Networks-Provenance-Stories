import { $, setText } from "./utils.js";

function getColorForType(t = "") {
  switch (t.toLowerCase()) {
    case "place": return "#ffa500";
    case "museum": return "#ffff00";
    case "institution": return "#800080";
    case "greenperson": return "#008000";
      default: return "#636363ff";
    // default: return "#1e90ff";
  }
}

export function drawNetworkForEvent(ev) {
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
