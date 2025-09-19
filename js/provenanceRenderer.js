
export function renderInteractiveProvenanceD3(provenanceTimeline, provenanceEvents, eventHandlerCallback) {
  const provenanceContainer = d3.select("#story-div-placeholder");
  const timelineContainer = d3.select("#timeline-placeholder").attr("class", "timeline-container");

  if (!provenanceTimeline || !provenanceEvents || provenanceContainer.empty() || timelineContainer.empty()) {
    provenanceContainer.style("display", "none");
    timelineContainer.style("display", "none");
    console.warn("Provenance data or HTML placeholders are missing.");
    return;
  }
  provenanceContainer.style("display", "block").html("<h2>Provenance</h2>");

  const entries = provenanceTimeline.entries || [];
  const events  = provenanceTimeline.events  || [];

  //
  const timelineIndexToEntryId = {};
  (events || []).forEach((ev, i) => {
    if (ev && ev.entryId) timelineIndexToEntryId[i] = ev.entryId;
  });

  const entryIdToEventIndex = {};
  (events || []).forEach((ev, i) => {
    if (ev && ev.entryId && !(ev.entryId in entryIdToEventIndex)) {
      entryIdToEventIndex[ev.entryId] = i;
    }
  });

  const entryIdToStoryId = {};
  (events || []).forEach((ev) => {
    if (ev && ev.entryId && ev.storyId !== null && ev.storyId !== undefined) {
      entryIdToStoryId[ev.entryId] = ev.storyId;
    }
  });

  const storyIdToEntryIds = {};
  Object.entries(entryIdToStoryId).forEach(([eid, sid]) => {
    (storyIdToEntryIds[sid] ||= []).push(eid);
  });

  const entryToStoryMap = {};
  entries.forEach(e => {
    const sid = entryIdToStoryId[e.id];
    entryToStoryMap[e.id] = (sid === undefined) ? [] : [sid];
  });

  const entryOrderIndex = {}; entries.forEach((e,i)=> entryOrderIndex[e.id]=i);
  Object.keys(storyIdToEntryIds).forEach(sid => {
    storyIdToEntryIds[sid].sort((a,b)=> entryOrderIndex[a] - entryOrderIndex[b]);
  });
  const primaryEntryForStory = {};
  Object.keys(storyIdToEntryIds).forEach(sid => {
    const list = storyIdToEntryIds[sid];
    if (list && list.length) primaryEntryForStory[sid] = list[0];
  });

  // 
  window.__provMap = {
    entryToStoryMap,
    storyIdToEntryIds,
    primaryEntryForStory,
    entryOrderIndex,
    timelineIndexToEntryId,
    entryIdToStoryId,
    entryIdToEventIndex,
  };

  
  const paragraph = provenanceContainer.append("p");
  paragraph.selectAll("span.provenance-entry")
    .data(entries).enter().append("span")
    .attr("class", "provenance-entry")
    .style("cursor", (d) => (entryIdToStoryId[d.id] !== undefined ? "pointer" : "default"))
    .attr("data-story-ids", (d) => (entryIdToStoryId[d.id] !== undefined ? JSON.stringify([entryIdToStoryId[d.id]]) : null))
    .text((d) => d.fullText + " ")
    .on("click", function () {
      const d = d3.select(this).datum();
      const sid = entryIdToStoryId[d.id];
      if (sid === undefined || sid === null) return;
      window.__provSelection = { mode: "entry", entryId: d.id, storyId: sid };
      eventHandlerCallback(sid);
    });


  const timelineWrapper = timelineContainer.append("div").attr("class", "timeline-wrapper");
  const timelineEl = timelineWrapper.append("div").attr("class", "timeline")
    .style("min-width", `${events.length * 180}px`);

  const items = timelineEl.selectAll(".timeline-item")
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

  items.append("div").attr("class", "timeline-content")
    .append("div").attr("class", "timeline-event").text((d) => d.event);
  items.append("div").attr("class", "timeline-point");
  items.append("div").attr("class", "timeline-date-label").text((d) => d.date);


  const prevBtn = timelineContainer.append("button").attr("id", "timeline-scroll-prev").attr("class", "timeline-scroll-btn")
    .html('<span class="arrow">&#x2039;</span><span class="nav-text">Prev</span>');
  const nextBtn = timelineContainer.append("button").attr("id", "timeline-scroll-next").attr("class", "timeline-scroll-btn")
    .html('<span class="nav-text">Next</span><span class="arrow">&#x203A;</span>');

  function updateScrollButtons() {
    const el = timelineWrapper.node();
    prevBtn.classed("hidden", el.scrollLeft <= 2);
    nextBtn.classed("hidden", el.scrollWidth - el.clientWidth - el.scrollLeft <= 2);
  }
  prevBtn.on("click", () => timelineWrapper.node().scrollBy({ left: -360, behavior: "smooth" }));
  nextBtn.on("click", () => timelineWrapper.node().scrollBy({ left: 360, behavior: "smooth" }));
  timelineWrapper.on("scroll", updateScrollButtons);
  new ResizeObserver(updateScrollButtons).observe(timelineWrapper.node());
  setTimeout(updateScrollButtons, 100);

  (function setupAutoHeight() {
    const TL_SELECTOR = ".timeline";
    const root = timelineEl.node();

    function getPaddingTB(el) {
      const cs = getComputedStyle(el);
      const pt = parseFloat(cs.paddingTop)  || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      return { pt, pb };
    }


    function measureWithMargin(el, side ) {
      if (!el) return 0;
      const h  = el.offsetHeight || 0;
      const cs = getComputedStyle(el);
      const m  = parseFloat(side === 'top' ? cs.marginTop : cs.marginBottom) || 0;
      return h + m;
    }


    function maxGroup(list, side) {
      let m = 0;
      list.forEach(el => { m = Math.max(m, measureWithMargin(el, side)); });
      return m;
    }


    function autoAdjust() {
      if (!root) return;


      const topBubbles   = root.querySelectorAll(".timeline-item:nth-child(even) .timeline-content");
      const bottomBubbles= root.querySelectorAll(".timeline-item:nth-child(odd)  .timeline-content");
      const topDates     = root.querySelectorAll(".timeline-item:nth-child(even) .timeline-date-label");
      const bottomDates  = root.querySelectorAll(".timeline-item:nth-child(odd)  .timeline-date-label");

      const HEADROOM = 24; 

      const topMaxBubble    = maxGroup(topBubbles, 'bottom');
      const bottomMaxBubble = maxGroup(bottomBubbles, 'top');  

      const topMaxDate      = maxGroup(topDates, 'bottom');
      const bottomMaxDate   = maxGroup(bottomDates, 'top');

      const upperNeeded = Math.ceil(topMaxBubble + topMaxDate + HEADROOM);
      const lowerNeeded = Math.ceil(bottomMaxBubble + bottomMaxDate + HEADROOM);

      const { pt, pb } = getPaddingTB(root);
      const BASE_MIN = 350; 

      const needed = Math.max(BASE_MIN, upperNeeded + lowerNeeded) + pt + pb;

      const currentVar = parseFloat(getComputedStyle(root).getPropertyValue("--tl-min-height")) || BASE_MIN;
      const target = Math.max(currentVar, needed);
      root.style.setProperty("--tl-min-height", `${target}px`);
    }

    requestAnimationFrame(() => { autoAdjust(); });
    setTimeout(() => { autoAdjust(); }, 0);

    window.addEventListener("resize", autoAdjust);


    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(autoAdjust).catch(() => {});
    }


    const containerRO = new ResizeObserver(autoAdjust);
    containerRO.observe(timelineWrapper.node());

    const bubbleRO = new ResizeObserver(autoAdjust);
    const observeBubbles = () => {
      const bubbles = root.querySelectorAll(".timeline-content, .timeline-date-label");
      bubbles.forEach(el => bubbleRO.observe(el));
    };
    observeBubbles();
  })();
}
