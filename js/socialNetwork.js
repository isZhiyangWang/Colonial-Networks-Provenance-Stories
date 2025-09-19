
function getColorForType(t = "") {
  switch (t.toLowerCase()) {
    case "place": return "#ffa500";
    case "museum": return "#ffff00";
    case "institution": return "#800080";
    case "greenperson": return "#008000";
    default: return "#1e90ff";
  }
}

export function drawSocialNetwork(container, w, h, socialNetworkData) {
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
