// 地图与事件处理：绘线、标记、点击弹窗
// 只关注地图与 placeCounts 统计，UI 文本由外部控制
export function buildMap(containerId = "map") {
  const map = L.map(containerId);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
  return map;
}

export function processProvenanceOnMap({ map, provenanceEvents, placeData, onLineClick }) {
  const placeCounts = {};
  let lastLocation = null;

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

  const bump = (key) => { placeCounts[key] = (placeCounts[key] || 0) + 1; };

  provenanceEvents.forEach((ev, index) => {
    ev.singlePlace = null;

    if (ev.changedLocation) {
      const pairs = ev.networkPairs || [];

      if (pairs.length > 0) {
        pairs.forEach((pair) => {
          const from = placeData[pair.source];
          const to = placeData[pair.target];
          if (!from || !to || pair.source === pair.target) return;

          const line = addLineWithLabel(from.coords, to.coords,
            { color: "#555", weight: 3, opacity: 0.8 },
            pair.label || ""
          );
          if (onLineClick) line.on("click", () => onLineClick(index));
        });
      }

      if (ev.from && ev.to && ev.from !== ev.to && placeData[ev.from] && placeData[ev.to]) {
        addLineWithLabel(placeData[ev.from].coords, placeData[ev.to].coords,
          { color: "#e74c3c", weight: 2, opacity: 0.7, dashArray: "5,5" },
          ev.eventType || "moved"
        );
      }

      const finalLoc = ev.to;
      if (finalLoc && placeData[finalLoc]) {
        ev.singlePlace = finalLoc; bump(finalLoc); lastLocation = finalLoc;
      } else if (lastLocation) {
        ev.singlePlace = lastLocation; bump(lastLocation);
      }
    } else {
      if (ev.from && placeData[ev.from]) {
        ev.singlePlace = ev.from; bump(ev.from); lastLocation = ev.from;
      } else if (lastLocation) {
        ev.singlePlace = lastLocation; bump(lastLocation);
      }
    }
  });

  return { placeCounts };
}

export function plotPlaces({ map, placeData, placeCounts, provenanceEvents, openEventModal }) {
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

    const relevant = provenanceEvents.filter((ev) => {
      if (ev.singlePlace === placeKey) return true;
      if (ev.from === placeKey || ev.to === placeKey) return true;
      if (ev.networkPairs?.length) return ev.networkPairs.some(p => p.source === placeKey || p.target === placeKey);
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

  setTimeout(() => {
    map.invalidateSize();
    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
    } else {
      map.setView([48.8566, 2.3522], 5);
    }
  }, 100);
}
