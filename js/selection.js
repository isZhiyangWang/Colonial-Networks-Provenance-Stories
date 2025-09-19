
export function installHighlightSelection() {
  window.highlightSelection = function(sel) {

    d3.selectAll(
      ".provenance-entry.highlighted, .provenance-entry.sub-highlight, .timeline-item.highlighted, " +
      ".provenance-entry.is-primary, .provenance-entry.is-related, .timeline-item.is-primary, .timeline-item.is-related"
    ).classed("highlighted", false).classed("sub-highlight", false)
     .classed("is-primary", false).classed("is-related", false);

    if (!sel) return;

    const map = window.__provMap || {};
    const storyId = sel.storyId;
    const entryId = sel.entryId;

    if (storyId === null || storyId === undefined) return;

    const tlSel = d3.selectAll(`.timeline-item[data-story-id='${storyId}']`).classed("is-related", true);

    let preferredIdx = null;

    if (typeof sel.preferredTimelineIndex === "number") {
      preferredIdx = sel.preferredTimelineIndex;
    }

    if (preferredIdx == null && sel.mode === "entry" && entryId) {
      const candidates = map.entryIdToEventIndices?.[entryId] || [];
      const hit = candidates.find(i => map.timelineIndexToEntryId?.[i] === entryId);
      if (typeof hit === "number") {
        preferredIdx = hit;
      } else if (typeof map.entryIdToEventIndex?.[entryId] === "number") {
        preferredIdx = map.entryIdToEventIndex[entryId];
      }
    }

    if (preferredIdx == null && !tlSel.empty()) {
      const firstNode = tlSel.nodes()[0];
      if (firstNode) preferredIdx = +firstNode.getAttribute("data-idx");
    }

    let primaryTimelineNode = null;
    if (typeof preferredIdx === "number") {
      tlSel.each(function () {
        if (+this.getAttribute("data-idx") === preferredIdx) primaryTimelineNode = this;
      });
    }
    if (!primaryTimelineNode && !tlSel.empty()) {
      primaryTimelineNode = tlSel.nodes()[0];
    }

    if (primaryTimelineNode) {
      d3.select(primaryTimelineNode).classed("is-primary", true);
      primaryTimelineNode.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
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

      if (eidFromIndex) {
        primaryEntryId = eidFromIndex;
      } else {
        relatedEntryIds = [];
      }
    } else if (sel.mode === "entry") {
      const sidOfEntry = map.entryIdToStoryId ? map.entryIdToStoryId[entryId] : undefined;
      if (sidOfEntry === undefined || sidOfEntry === null) return;

      if (entryId && relatedEntryIds.includes(entryId)) {
        primaryEntryId = entryId;
      }
    }

    if (!primaryEntryId && relatedEntryIds.length > 0 && map.primaryEntryForStory) {
      primaryEntryId = map.primaryEntryForStory[storyId];
    }

    relatedEntryIds.forEach((eid) => {
      const span = d3.selectAll("span.provenance-entry")
        .filter(function () { return d3.select(this).datum().id === eid; })
        .classed("is-related", true);
      if (eid === primaryEntryId) span.classed("is-primary", true);
    });

    if (primaryEntryId) {
      const mainSel = d3.selectAll("span.provenance-entry")
        .filter(function () { return d3.select(this).datum().id === primaryEntryId; });
      if (!mainSel.empty()) mainSel.nodes()[0].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
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
}
