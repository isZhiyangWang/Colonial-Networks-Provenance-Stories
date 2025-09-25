// ======================== renderInteractiveProvenanceD3 ========================
export function renderInteractiveProvenanceD3(provenanceTimeline, provenanceEvents, eventHandlerCallback) {

  const provenanceContainer = d3.select("#story-div-placeholder");
  const timelineContainer   = d3.select("#timeline-placeholder").attr("class", "timeline-container");

  if (!provenanceTimeline || !provenanceEvents || provenanceContainer.empty() || timelineContainer.empty()) {
    provenanceContainer.style("display", "none");
    timelineContainer.style("display", "none");
    console.warn("Provenance data or HTML placeholders are missing.");
    return;
  }
  provenanceContainer.style("display", "block").html("<h2>Provenance</h2>");

  // --- Helpers (Source line) --------------------------------------------------
  function toArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }
  function sanitizeUrl(u) {
    try { const url = new URL(String(u).trim()); if (url.protocol === "http:" || url.protocol === "https:") return url.toString(); }
    catch(_){}; return null;
  }
  function prettyHostname(u) { try { return new URL(u).hostname.replace(/^www\./i,""); } catch(_) { return "link"; } }
  function escapeHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function normalizeSources(raw) {
    const out=[]; toArray(raw).forEach((it)=>{ if(!it) return;
      if(typeof it==="string"){ const url=sanitizeUrl(it); if(url) out.push({url,text:prettyHostname(url)}); }
      else if(typeof it==="object"){ const url=sanitizeUrl(it.url||it.href); if(!url) return; const text=(it.text||it.label||it.title||"").trim()||prettyHostname(url); out.push({url,text}); }
    }); return out;
  }

  // --- Helpers (inline styling) ----------------------------------------------
  function escapeRegex(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }


  function normalizeNames(raw) {
    const arr = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
    const seen = new Set();
    const out = [];
    arr.forEach(v => {
      const s = String(v || "").trim();
      if (!s) return;
      const key = s.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(s); }
    });
    return out;
  }


function buildNameRegex(term) {
  const s = String(term || "");
  const escaped = escapeRegex(s);


  const hasWord = /\p{L}|\p{N}/u.test(s);

  if (!hasWord) {
    return new RegExp(escaped, "giu");
  }

  const LB = "(?<![\\p{L}\\p{N}_])";
  const RB = "(?![\\p{L}\\p{N}_])";
  return new RegExp(`${LB}${escaped}${RB}`, "giu");
}

function findAllOccurrences(haystack, needle){
    const out=[]; if(!needle) return out;
    const re = needle instanceof RegExp ? needle : new RegExp(escapeRegex(needle), "giu");
    const text = String(haystack || "");
    let m;
    while((m=re.exec(text))!==null){
      out.push({start:m.index,end:m.index+m[0].length,styles:{bold:true}});
      if(re.lastIndex===m.index) re.lastIndex++;
    }
    return out;
}


  function buildStyledHtml(fullText, greenTerms, eventsToBold, forceEntryBold) {
    const text = String(fullText || "");
    const ranges = [];

    (greenTerms || []).forEach(term => {
      if (!term) return;
      const occ = findAllOccurrences(text, buildNameRegex(term));
      occ.forEach(o => { o.styles = { ...o.styles, green: true }; });
      ranges.push(...occ);
    });

    (eventsToBold || []).filter(Boolean).forEach((evt)=>{
      const occ = findAllOccurrences(text, buildNameRegex(evt));
      occ.forEach(o => { o.styles = { ...o.styles, event:true }; });
      ranges.push(...occ);
    });

    ranges.sort((a,b)=> a.start-b.start || b.end-a.end);
    const merged=[];
    for(const r of ranges){
      let placed=false;
      for(let i=0;i<merged.length;i++){
        const m=merged[i];
        if(!(r.end<=m.start || r.start>=m.end)){
          const segs=[];
          if(r.start>m.start) segs.push({start:m.start,end:r.start,styles:{...m.styles}});
          const midStart=Math.max(r.start,m.start), midEnd=Math.min(r.end,m.end);
          segs.push({start:midStart,end:midEnd,styles:{...m.styles,...r.styles}});
          if(r.end<m.end) segs.push({start:midEnd,end:m.end,styles:{...m.styles}});
          merged.splice(i,1,...segs);
          if(r.end>m.end){ ranges.push({start:m.end,end:r.end,styles:{...r.styles}}); }
          placed=true; break;
        }
      }
      if(!placed) merged.push({...r});
    }

    merged.sort((a,b)=> a.start-b.start);
    const finalSegs=[]; let cursor=0;
    for(const seg of merged){ if(cursor<seg.start) finalSegs.push({start:cursor,end:seg.start,styles:{}}); finalSegs.push(seg); cursor=seg.end; }
    if(cursor<text.length) finalSegs.push({start:cursor,end:text.length,styles:{}});

    return finalSegs.map(({start,end,styles})=>{
      const chunk = escapeHtml(text.slice(start,end));
      const classes=["prov-chunk"];
      if (styles.event) classes.push("prov-event-mention");
      if (styles.green) classes.push("colonial-figure");
      return `<span class="${classes.join(" ")}${forceEntryBold ? " prov-entry-bold" : ""}">${chunk}</span>`;
    }).join("");
  }

  const entries = provenanceTimeline.entries || [];
  const events  = provenanceTimeline.events  || [];

  // --- Normalize story ids per event (support single or array) ---------------
  function storyIdsOf(ev) {
    if (!ev) return [];
    const raw = ev.storyId;
    if (raw == null) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  // --- Index maps -------------------------------------------------------------
  const timelineIndexToEntryId = {};
  (events||[]).forEach((ev,i)=>{ if(ev && ev.entryId) timelineIndexToEntryId[i]=ev.entryId; });

  const entryIdToEventIndex = {};
  (events||[]).forEach((ev,i)=>{ if(ev && ev.entryId && !(ev.entryId in entryIdToEventIndex)) entryIdToEventIndex[ev.entryId]=i; });

  const entryIdToStoryId = {};
  (events||[]).forEach((ev)=>{
    const sids = storyIdsOf(ev);
    if (ev && ev.entryId && sids.length) {
      if (entryIdToStoryId[ev.entryId] === undefined) entryIdToStoryId[ev.entryId] = sids[0];
    }
  });

  const storyIdToEntryIds = {};
  Object.entries(entryIdToStoryId).forEach(([eid,sid])=>{ (storyIdToEntryIds[sid] ||= []).push(eid); });

  const entryToStoryMap = {};
  entries.forEach(e=>{ const sid=entryIdToStoryId[e.id]; entryToStoryMap[e.id]=(sid===undefined)?[]:[sid]; });

  const entryOrderIndex = {}; entries.forEach((e,i)=> entryOrderIndex[e.id]=i);
  Object.keys(storyIdToEntryIds).forEach(sid=> storyIdToEntryIds[sid].sort((a,b)=> entryOrderIndex[a]-entryOrderIndex[b]));
  const primaryEntryForStory = {};
  Object.keys(storyIdToEntryIds).forEach(sid=>{ const list=storyIdToEntryIds[sid]; if(list && list.length) primaryEntryForStory[sid]=list[0]; });

  const storyIdToEventsMap = {};
  (events||[]).forEach(e=>{
    const sids = storyIdsOf(e);
    if (e && sids.length && e.event) {
      sids.forEach(sid => (storyIdToEventsMap[sid] ||= []).push(e.event));
    }
  });

  window.__provMap = {
    entryToStoryMap,
    storyIdToEntryIds,
    primaryEntryForStory,
    entryOrderIndex,
    timelineIndexToEntryId,
    entryIdToStoryId,
    entryIdToEventIndex,
  };

  // --- Provenance paragraph ---------------------------------------------------
  const paragraph = provenanceContainer.append("p");

  paragraph.selectAll("span.provenance-entry")
    .data(entries).enter().append("span")
    .attr("class", "provenance-entry")
    .attr("data-entry-id", d => d.id)
    .attr("data-story-id", d => (entryIdToStoryId[d.id] != null ? String(entryIdToStoryId[d.id]) : ""))
    .style("cursor", d => (entryIdToStoryId[d.id] !== undefined ? "pointer" : "default"))
    .html((d) => {
      const isGreenColor = (d.figure && String(d.figure).toLowerCase() === "green");

      const greenTerms = isGreenColor ? normalizeNames(d.owner) : [];

      const sid = entryIdToStoryId[d.id];
      const forceEntryBold = !!(sid !== undefined && sid !== null);
      const relevantEvents = forceEntryBold ? (storyIdToEventsMap[sid] || []) : [];

      return buildStyledHtml(d.fullText, greenTerms, relevantEvents, forceEntryBold) + " ";
    })
    .on("click", function() {
      const d = d3.select(this).datum();
      const sid = entryIdToStoryId[d.id];
      if (sid === undefined || sid === null) return;
      window.__provSelection = { mode: "entry", entryId: d.id, storyId: sid };
      eventHandlerCallback(sid);
      if (typeof window.highlightSelection === "function") window.highlightSelection(window.__provSelection);
    });

  // --- Source line ------------------------------------------------------------
  const sources = normalizeSources(
    provenanceTimeline.sources ?? provenanceTimeline.source ?? provenanceTimeline.provenanceSource
  );
  if (sources.length) {
    const src = provenanceContainer.append("p").attr("class", "provenance-source");
    const linksHtml = sources.map(s => `<a class="provenance-source-link" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.text)}</a>`).join(", ");
    src.html(`Source: ${linksHtml}`);
  }

  // --- Timeline ---------------------------------------------------------------
  const timelineWrapper = timelineContainer.append("div").attr("class", "timeline-wrapper");
  const timelineEl = timelineWrapper.append("div").attr("class", "timeline")
    .style("min-width", `${events.length * 180}px`);

  const items = timelineEl.selectAll(".timeline-item")
    .data(events).enter().append("div")
    .attr("class", "timeline-item")
    .attr("data-story-id", d => {
      const sids = storyIdsOf(d);
      return sids.length ? String(sids[0]) : "";
    })
    .attr("data-story-ids", d => {
      const sids = storyIdsOf(d).map(String);
      return sids.length ? JSON.stringify(sids) : "[]";
    })
    .attr("data-idx", (d,i)=> i)
    .on("click", function () {
      const d = d3.select(this).datum();
      const sids = storyIdsOf(d);
      if (!sids.length) return; // unlinked, ignore
      const primarySid = sids[0]; 
      const idx = +this.getAttribute("data-idx");
      window.__provSelection = { mode: "timeline", storyId: primarySid, preferredTimelineIndex: idx };
      eventHandlerCallback(primarySid);
      if (typeof window.highlightSelection === "function") window.highlightSelection(window.__provSelection);
    });


  items.filter(d => storyIdsOf(d).length === 0)
    .attr("data-unlinked", "1")
    .attr("title", "Unlinked timeline item — hover to reveal details");

  items.append("div").attr("class", "timeline-content")
    .append("div").attr("class", "timeline-event").text(d => d.event);
  items.append("div").attr("class", "timeline-point");
  items.append("div").attr("class", "timeline-date-label").text(d => d.date);

  // --- Scroll buttons & auto hide --------------------------------------------
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

  timelineWrapper.on("click.delegated", function(event){
    const target = event.target.closest(".timeline-item");
    if (!target || !timelineWrapper.node().contains(target)) return;

    let sids = [];
    const idsAttr = target.getAttribute("data-story-ids");
    if (idsAttr) {
      try { const arr = JSON.parse(idsAttr); if (Array.isArray(arr)) sids = arr; } catch(_) {}
    }
    if (!sids.length) {
      const sidAttr = target.getAttribute("data-story-id");
      if (sidAttr) sids = [sidAttr];
    }
    if (!sids.length) return;

    const primarySid = isNaN(+sids[0]) ? sids[0] : +sids[0];
    const idx = +target.getAttribute("data-idx");
    window.__provSelection = { mode: "timeline", storyId: primarySid, preferredTimelineIndex: idx };
    if (typeof window.highlightSelection === "function") window.highlightSelection(window.__provSelection);
    event.stopPropagation();
  });

  provenanceContainer.on("click.delegated", function(event){
    const node = event.target.closest("span.provenance-entry");
    if (!node || !provenanceContainer.node().contains(node)) return;
    const sidAttr = node.getAttribute("data-story-id");
    const eidAttr = node.getAttribute("data-entry-id");
    if (!sidAttr) return; 
    const sid = isNaN(+sidAttr) ? sidAttr : +sidAttr;
    window.__provSelection = { mode: "entry", storyId: sid, entryId: eidAttr };
    if (typeof window.highlightSelection === "function") window.highlightSelection(window.__provSelection);
    event.stopPropagation();
  });

  // --- Auto height ------------------------------------------------------------
  (function setupAutoHeight() {
    const root = timelineEl.node();
    function getPaddingTB(el){ const cs=getComputedStyle(el); return { pt:parseFloat(cs.paddingTop)||0, pb:parseFloat(cs.paddingBottom)||0 }; }
    function measureWithMargin(el,side){ if(!el) return 0; const h=el.offsetHeight||0; const cs=getComputedStyle(el); const m=parseFloat(side==='top'?cs.marginTop:cs.marginBottom)||0; return h+m; }
    function maxGroup(list,side){ let m=0; list.forEach(el=>{ m=Math.max(m,measureWithMargin(el,side)); }); return m; }
    function autoAdjust(){
      if(!root) return;
      const topBubbles   = root.querySelectorAll(".timeline-item:nth-child(even) .timeline-content");
      const bottomBubbles= root.querySelectorAll(".timeline-item:nth-child(odd)  .timeline-content");
      const topDates     = root.querySelectorAll(".timeline-item:nth-child(even) .timeline-date-label");
      const bottomDates  = root.querySelectorAll(".timeline-item:nth-child(odd)  .timeline-date-label");
      const HEADROOM = 24;
      const topMaxBubble    = maxGroup(topBubbles,'bottom');
      const bottomMaxBubble = maxGroup(bottomBubbles,'top');
      const topMaxDate      = maxGroup(topDates,'bottom');
      const bottomMaxDate   = maxGroup(bottomDates,'top');
      const upperNeeded = Math.ceil(topMaxBubble + topMaxDate + HEADROOM);
      const lowerNeeded = Math.ceil(bottomMaxBubble + bottomMaxDate + HEADROOM);
      const {pt,pb}=getPaddingTB(root);
      const BASE_MIN=350;
      const needed = Math.max(BASE_MIN, upperNeeded + lowerNeeded) + pt + pb;
      const currentVar = parseFloat(getComputedStyle(root).getPropertyValue("--tl-min-height")) || BASE_MIN;
      const target = Math.max(currentVar, needed);
      root.style.setProperty("--tl-min-height", `${target}px`);
    }
    requestAnimationFrame(autoAdjust);
    setTimeout(autoAdjust, 0);
    window.addEventListener("resize", autoAdjust);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(autoAdjust).catch(()=>{}); }
    const containerRO = new ResizeObserver(autoAdjust); containerRO.observe(timelineWrapper.node());
    const bubbleRO = new ResizeObserver(autoAdjust);
    const observeBubbles=()=>{ const bubbles=root.querySelectorAll(".timeline-content, .timeline-date-label"); bubbles.forEach(el=>bubbleRO.observe(el)); };
    observeBubbles();
  })();
}
