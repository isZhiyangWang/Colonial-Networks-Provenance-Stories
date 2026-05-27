function getColorForType(t = "") {
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
      return "#636363ff";
  }
}

function getEdgeLabelPosition(sourceNode, targetNode, labelOffset = 14) {
  const midX = (sourceNode.x + targetNode.x) / 2;
  const midY = (sourceNode.y + targetNode.y) / 2;

  const dx = targetNode.x - sourceNode.x;
  const dy = targetNode.y - sourceNode.y;
  const len = Math.hypot(dx, dy) || 1;

  return {
    x: midX + (-dy / len) * labelOffset,
    y: midY + (dx / len) * labelOffset,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetLabelPositions(labelSelection) {
  labelSelection
    .attr("x", (d) => d.labelX)
    .attr("y", (d) => d.labelY);
}

function resolveLabelCollisions(labelNodes, width, height) {
  const padding = 5;
  const iterations = 18;

  if (!labelNodes || labelNodes.length < 2) return;

  for (let iter = 0; iter < iterations; iter += 1) {
    let moved = false;

    for (let i = 0; i < labelNodes.length; i += 1) {
      for (let j = i + 1; j < labelNodes.length; j += 1) {
        const a = labelNodes[i];
        const b = labelNodes[j];

        if (!a || !b) continue;

        const boxA = a.getBBox();
        const boxB = b.getBBox();

        const ax1 = boxA.x - padding;
        const ax2 = boxA.x + boxA.width + padding;
        const ay1 = boxA.y - padding;
        const ay2 = boxA.y + boxA.height + padding;

        const bx1 = boxB.x - padding;
        const bx2 = boxB.x + boxB.width + padding;
        const by1 = boxB.y - padding;
        const by2 = boxB.y + boxB.height + padding;

        const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
        const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);

        if (overlapX <= 0 || overlapY <= 0) continue;

        const centerAX = boxA.x + boxA.width / 2;
        const centerAY = boxA.y + boxA.height / 2;
        const centerBX = boxB.x + boxB.width / 2;
        const centerBY = boxB.y + boxB.height / 2;

        const directionX = centerAX <= centerBX ? -1 : 1;
        const directionY = centerAY <= centerBY ? -1 : 1;

        const aX = Number(a.getAttribute("x")) || 0;
        const aY = Number(a.getAttribute("y")) || 0;
        const bX = Number(b.getAttribute("x")) || 0;
        const bY = Number(b.getAttribute("y")) || 0;

        if (overlapX < overlapY) {
          const shift = overlapX / 2 + padding;
          a.setAttribute("x", clamp(aX + directionX * shift, 18, width - 18));
          b.setAttribute("x", clamp(bX - directionX * shift, 18, width - 18));
        } else {
          const shift = overlapY / 2 + padding;
          a.setAttribute("y", clamp(aY + directionY * shift, 18, height - 18));
          b.setAttribute("y", clamp(bY - directionY * shift, 18, height - 18));
        }

        moved = true;
      }
    }

    if (!moved) break;
  }
}

export function drawSocialNetwork(container, w, h, socialNetworkData) {
  container.selectAll("*").remove();

  const svg = container
    .append("svg")
    .attr("width", w)
    .attr("height", h)
    .style("background", "#fff");

  const zoomContainer = svg.append("g");

  const fixedNodeRadius = 12;
  const nodes = socialNetworkData.nodes.map((d) => ({
    ...d,
    radius: fixedNodeRadius,
  }));

  const links = socialNetworkData.edges.map((d) => ({ ...d }));

  const radius = Math.min(w, h) / 2 - 120;
  const centerX = w / 2;
  const centerY = h / 2;
  const angleStep = (2 * Math.PI) / nodes.length;

  nodes.forEach((node, i) => {
    const angle = i * angleStep;
    node.x = centerX + radius * Math.cos(angle);
    node.y = centerY + radius * Math.sin(angle);
  });

  const linksWithCoords = links
    .map((link) => {
      const sourceNode = nodes.find((n) => n.id === link.source);
      const targetNode = nodes.find((n) => n.id === link.target);

      if (!sourceNode || !targetNode) return null;

      const labelOffset = typeof link.labelOffset === "number" ? link.labelOffset : 14;
      const labelPosition = getEdgeLabelPosition(sourceNode, targetNode, labelOffset);

      return {
        source: sourceNode,
        target: targetNode,
        relationship: link.relationship || "",
        labelOffset,
        labelX: labelPosition.x,
        labelY: labelPosition.y,
      };
    })
    .filter(Boolean);

  const link = zoomContainer
    .selectAll(".social-link")
    .data(linksWithCoords)
    .enter()
    .append("line")
    .attr("class", "social-link")
    .attr("stroke", "#bbb")
    .attr("stroke-width", 1.5)
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);

  const linkLabel = zoomContainer
    .selectAll(".social-link-label")
    .data(linksWithCoords)
    .enter()
    .append("text")
    .attr("class", "social-link-label")
    .text((d) => d.relationship)
    .attr("x", (d) => d.labelX)
    .attr("y", (d) => d.labelY)
    .attr("text-anchor", "middle")
    .style("font-family", "Arial, sans-serif")
    .style("font-size", "10px")
    .style("font-weight", "normal")
    .style("fill", "#666")
    .style("pointer-events", "none")
    .style("paint-order", "stroke")
    .style("stroke", "white")
    .style("stroke-width", "2px")
    .style("stroke-linejoin", "round");

  const node = zoomContainer
    .selectAll(".social-node")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "social-node-group")
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  node
    .append("circle")
    .attr("r", (d) => d.radius)
    .attr("fill", (d) => getColorForType(d.type))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5);

  const nodeLabel = zoomContainer
    .selectAll(".node-label-group")
    .data(nodes)
    .enter()
    .append("text")
    .attr("class", "social-node-label")
    .text((d) => d.id)
    .style("font-size", "12px")
    .style("font-weight", "500")
    .style("fill", "#333")
    .style("pointer-events", "none")
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

  linkLabel.raise();

  const nodeGroups = zoomContainer.selectAll(".social-node-group");

  nodeGroups
    .on("mouseover", function (event, d) {
      const connectedIds = new Set([d.id]);

      linksWithCoords.forEach((l) => {
        if (l.source.id === d.id) connectedIds.add(l.target.id);
        if (l.target.id === d.id) connectedIds.add(l.source.id);
      });

      resetLabelPositions(linkLabel);

      link.style("opacity", 0.1);
      nodeGroups.style("opacity", 0.1);
      nodeLabel.style("opacity", 0.1);
      linkLabel
        .style("opacity", 0.08)
        .style("font-size", "10px")
        .style("font-weight", "normal")
        .style("stroke-width", "2px");

      nodeGroups
        .filter((n) => connectedIds.has(n.id))
        .style("opacity", 1);

      nodeLabel
        .filter((n) => connectedIds.has(n.id))
        .style("opacity", 1)
        .raise();

      link
        .filter((l) => connectedIds.has(l.source.id) && connectedIds.has(l.target.id))
        .style("opacity", 1)
        .attr("stroke", "#777")
        .attr("stroke-width", 2);

      const activeLabels = linkLabel
        .filter((l) => l.source.id === d.id || l.target.id === d.id)
        .style("opacity", 1)
        .style("font-size", "11px")
        .style("font-weight", "700")
        .style("stroke-width", "3px");

      activeLabels.raise();

      requestAnimationFrame(() => {
        resolveLabelCollisions(activeLabels.nodes(), w, h);
      });
    })
    .on("mouseout", function () {
      nodeGroups.style("opacity", 1);

      link
        .style("opacity", 1)
        .attr("stroke", "#bbb")
        .attr("stroke-width", 1.5);

      nodeLabel.style("opacity", 1);

      linkLabel
        .style("opacity", 1)
        .style("font-size", "10px")
        .style("font-weight", "normal")
        .style("stroke-width", "2px");

      resetLabelPositions(linkLabel);
      linkLabel.raise();
    });

  const zoom = d3
    .zoom()
    .scaleExtent([0.3, 10])
    .on("zoom", (event) => {
      zoomContainer.attr("transform", event.transform);
    });

  svg.call(zoom);

  d3.select("#reset-zoom-btn").on("click", () => {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
  });
}