// =========================== installHighlightSelection ========================
export function installHighlightSelection() {

document.body.classList.remove("has-cohort-focus");

const _popover = document.getElementById("story-cohort-popover");
if (_popover) {
  _popover.classList.add("hidden");
  _popover.innerHTML = "";
  _popover.style.left = "-9999px";
  _popover.style.top  = "-9999px";
  _popover.removeAttribute("data-story-id");
}

d3.selectAll(
  ".provenance-entry.highlighted, .provenance-entry.sub-highlight, .timeline-item.highlighted, " +
  ".provenance-entry.is-primary, .provenance-entry.is-related, .timeline-item.is-primary, .timeline-item.is-related"
).classed("highlighted", false).classed("sub-highlight", false)
 .classed("is-primary", false).classed("is-related", false);

window.__provSelection = null;

  function ensurePopoverRoot() {
    let el = document.getElementById("story-cohort-popover");
    if (!el) {
      el = document.createElement("div");
      el.id = "story-cohort-popover";
      el.className = "story-cohort-popover hidden";
      document.body.appendChild(el);
    }
    return el;
  }
  function hidePopover() {
    const el = document.getElementById("story-cohort-popover");
    if (el) {
      el.classList.add("hidden");
      el.innerHTML = "";
      el.style.left = "-9999px";
      el.style.top  = "-9999px";
      el.removeAttribute("data-story-id");
    }
  }
  function renderPopover(primaryNode, storyId, items) {
    const el = ensurePopoverRoot();
    el.setAttribute("data-story-id", String(storyId));
    const rows = items.map(it => {
      const dateHtml  = it.date ? `<span class="cohort-date">${escapeHtml(it.date)}</span>` : "";
      const labelHtml = `<span class="cohort-event">${escapeHtml(it.event || "(no title)")}</span>`;
      return `<li class="cohort-item" data-idx="${it.idx}" tabindex="0" role="button" aria-label="Jump to related event">${labelHtml}${dateHtml}</li>`;
    }).join("");
    el.innerHTML = `
      <div class="cohort-header">Also in this story</div>
      <ul class="cohort-list">
        ${rows || `<li class="cohort-empty">No other events</li>`}
      </ul>
      <div class="cohort-hint">Click to jump • Esc to dismiss</div>
    `;
    const rect = primaryNode.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    el.style.left = `${rect.left + scrollX + rect.width / 2 + 12}px`;
    el.style.top  = `${Math.max(8, rect.top + scrollY - 8)}px`;
    el.classList.remove("hidden");

    el.querySelectorAll(".cohort-item").forEach(li => {
      li.addEventListener("click", () => {
        const idx = Number(li.getAttribute("data-idx"));
        if (!Number.isNaN(idx)) {
          window.__provSelection = { mode: "timeline", storyId, preferredTimelineIndex: idx };
          if (typeof window.highlightSelection === "function") window.highlightSelection(window.__provSelection);
        }
      });
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); li.click(); }
      });
    });
  }

  window.highlightSelection = function(sel) {

    d3.selectAll(
      ".provenance-entry.highlighted, .provenance-entry.sub-highlight, .timeline-item.highlighted, " +
      ".provenance-entry.is-primary, .provenance-entry.is-related, .timeline-item.is-primary, .timeline-item.is-related"
    ).classed("highlighted", false).classed("sub-highlight", false)
     .classed("is-primary", false).classed("is-related", false);

    hidePopover();
    document.body.classList.remove("has-cohort-focus");

    if (!sel) return;

    const suppressAutoScroll = !!window.__suppressTimelineScrollOnce;
    if (window.__suppressTimelineScrollOnce) window.__suppressTimelineScrollOnce = false;

    const map = window.__provMap || {};
    const storyId = sel.storyId;
    const entryId = sel.entryId;
    if (storyId === null || storyId === undefined) return;

    const sidStr = String(storyId);

    const tlSel = d3.selectAll(".timeline-item").filter(function(){
      const node = this;
      const idsAttr = node.getAttribute("data-story-ids");
      let ids = [];
      if (idsAttr) { try { const arr = JSON.parse(idsAttr); if (Array.isArray(arr)) ids = arr; } catch(_) {} }
      if (!ids.length) {
        const single = node.getAttribute("data-story-id");
        if (single) ids = [single];
      }
      return ids.map(String).includes(sidStr);
    }).classed("is-related", true);

    let preferredIdx = null;
    if (typeof sel.preferredTimelineIndex === "number") preferredIdx = sel.preferredTimelineIndex;

    if (preferredIdx == null && sel.mode === "entry" && entryId) {
      const candidates = map.entryIdToEventIndices?.[entryId] || [];
      const hit = candidates.find(i => map.timelineIndexToEntryId?.[i] === entryId);
      if (typeof hit === "number") preferredIdx = hit;
      else if (typeof map.entryIdToEventIndex?.[entryId] === "number") preferredIdx = map.entryIdToEventIndex[entryId];
    }
    if (preferredIdx == null && !tlSel.empty()) {
      const firstNode = tlSel.nodes()[0];
      if (firstNode) preferredIdx = +firstNode.getAttribute("data-idx");
    }

    let primaryTimelineNode = null;
    if (typeof preferredIdx === "number") {
      tlSel.each(function(){ if (+this.getAttribute("data-idx") === preferredIdx) primaryTimelineNode = this; });
    }
    if (!primaryTimelineNode && !tlSel.empty()) primaryTimelineNode = tlSel.nodes()[0];
    if (primaryTimelineNode) {
      d3.select(primaryTimelineNode).classed("is-primary", true);
      if (!suppressAutoScroll) {
        primaryTimelineNode.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }

    let relatedEntryIds = (map.storyIdToEntryIds && map.storyIdToEntryIds[storyId]) ? map.storyIdToEntryIds[storyId] : [];
    let primaryEntryId = null;

    if (sel.mode === "timeline") {
      const idx = preferredIdx;
      const hasIdx = typeof idx === "number";
      const eidFromIndex = hasIdx && map.timelineIndexToEntryId
        && Object.prototype.hasOwnProperty.call(map.timelineIndexToEntryId, idx)
        ? map.timelineIndexToEntryId[idx]
        : null;
      if (eidFromIndex) primaryEntryId = eidFromIndex; else relatedEntryIds = [];
    } else if (sel.mode === "entry") {
      const sidOfEntry = map.entryIdToStoryId ? map.entryIdToStoryId[entryId] : undefined;
      if (sidOfEntry === undefined || sidOfEntry === null) return;
      if (entryId && relatedEntryIds.includes(entryId)) primaryEntryId = entryId;
    }
    if (!primaryEntryId && relatedEntryIds.length > 0 && map.primaryEntryForStory) {
      primaryEntryId = map.primaryEntryForStory[storyId];
    }

    relatedEntryIds.forEach((eid) => {
      const span = d3.selectAll("span.provenance-entry")
        .filter(function(){ return d3.select(this).attr("data-entry-id") === String(eid); })
        .classed("is-related", true);
      if (eid === primaryEntryId) span.classed("is-primary", true);
    });

    if (primaryEntryId && !suppressAutoScroll) {
      const mainSel = d3.selectAll("span.provenance-entry")
        .filter(function(){ return d3.select(this).attr("data-entry-id") === String(primaryEntryId); });
      if (!mainSel.empty()) mainSel.nodes()[0].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }

    document.body.classList.add("has-cohort-focus");

    if (!suppressAutoScroll && primaryTimelineNode) {
      const allNodes = tlSel.nodes();
      const cohort = [];
      allNodes.forEach(node => {
        const idx = +node.getAttribute("data-idx");
        if (idx === preferredIdx) return;
        const d = d3.select(node).datum() || {};
        cohort.push({ idx, event: d.event, date: d.date });
      });
      if (cohort.length > 0) renderPopover(primaryTimelineNode, storyId, cohort);
    }
  };

  window.highlightItemsForStory = function(storyId) {
    if (!window.__provSelection || window.__provSelection.mode === "story" || window.__provSelection.storyId !== storyId) {
      window.__provSelection = { mode: "story", storyId };
    } else {
      window.__provSelection.storyId = storyId;
    }
    if (typeof window.highlightSelection === "function") {
      window.highlightSelection(window.__provSelection);
    }
  };

  function clearFocusUI(){ hidePopover(); document.body.classList.remove("has-cohort-focus"); }
  document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") clearFocusUI(); });
  document.addEventListener("click", (e)=>{
    const pop = document.getElementById("story-cohort-popover");
    if (!pop || pop.classList.contains("hidden")) return;
    if (!pop.contains(e.target)) clearFocusUI();
  });
  window.addEventListener("resize", clearFocusUI);
  window.addEventListener("scroll",  clearFocusUI);

  function escapeHtml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
}
// ========================= /installHighlightSelection ========================
