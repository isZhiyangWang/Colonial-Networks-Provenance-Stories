(async function () {
  const container = document.getElementById("figures-container");
  if (!container) return;

  // Dataset verification rule: only pull candidates from dataset nodes with these types
  const DATASET_ALLOWED_TYPES = new Set(["person", "greenperson"]);

  const normalizeKey = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[’‘]/g, "'");

  const normalizeType = (t) => String(t || "").trim();

  async function fetchJsonSafe(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to fetch ${url} (${resp.status})`);
    return resp.json();
  }

  function isDatasetAllowedType(t) {
    return DATASET_ALLOWED_TYPES.has(String(t || "").trim().toLowerCase());
  }

  try {
    // 1) Manifest of datasets
    const manifest = await fetchJsonSafe("data/datasets.json");
    const datasetFiles = Array.isArray(manifest?.datasets) ? manifest.datasets : [];

    if (datasetFiles.length === 0) {
      container.innerHTML = "<p>No datasets listed in data/datasets.json.</p>";
      return;
    }

    // 2) Load key-figures add-on (authoritative overrides)
    let addon = [];
    try {
      const addonResp = await fetch("data/key-figures.json", { cache: "no-store" });
      if (addonResp.ok) {
        addon = await addonResp.json();
        if (!Array.isArray(addon)) addon = [];
      }
    } catch {
      addon = [];
    }

    // Build override map: key by id (fallback to name if your file still uses name)
    const addonMap = new Map();
    for (const a of addon) {
      const id = a?.id || a?.name; // supports old shape
      if (!id) continue;
      addonMap.set(normalizeKey(id), a);
    }

    // 3) Load all datasets and collect candidates
    const results = await Promise.allSettled(
      datasetFiles.map((file) => fetchJsonSafe(`data/${file}`))
    );

    // figureMap stores FINAL figures keyed by normalized id/name
    const figureMap = new Map();

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== "fulfilled") {
        console.warn(`Dataset failed: data/${datasetFiles[i]}`, r.reason);
        continue;
      }

      const data = r.value;
      const nodes = Array.isArray(data?.socialNetwork?.nodes) ? data.socialNetwork.nodes : [];
      if (nodes.length === 0) continue;

      for (const node of nodes) {
        const id = node?.id || node?.name;
        if (!id) continue;

        // Verification: dataset-only candidates must be person/greenperson
        if (!isDatasetAllowedType(node?.type)) continue;

        const key = normalizeKey(id);

        // Default from dataset
        const fromDataset = {
          id,
          type: normalizeType(node?.type),
          bio: node?.bio || "",
        };

        // If add-on exists, it WINS for bio/type (even if type is "Lord")
        const a = addonMap.get(key);
        const finalFig = a
          ? {
              id,
              type: a.type != null ? normalizeType(a.type) : fromDataset.type,
              bio: a.bio != null ? String(a.bio) : fromDataset.bio,
            }
          : fromDataset;

        // Merge (prefer existing bio if already set and add-on is empty, etc.)
        const existing = figureMap.get(key);
        if (!existing) {
          figureMap.set(key, finalFig);
        } else {
          figureMap.set(key, {
            id: existing.id || finalFig.id,
            type: existing.type || finalFig.type,
            bio: existing.bio || finalFig.bio,
          });
        }
      }
    }

    // 4) Optional: include add-on-only figures (not present in any dataset)
    // If you DON'T want this, delete this loop.
    for (const [key, a] of addonMap.entries()) {
      if (figureMap.has(key)) continue;

      const id = a?.id || a?.name;
      if (!id) continue;

      figureMap.set(key, {
        id,
        type: a.type != null ? normalizeType(a.type) : "",
        bio: a.bio != null ? String(a.bio) : "",
      });
    }

    // 5) Render
    const figures = Array.from(figureMap.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    );

    if (figures.length === 0) {
      container.innerHTML = "<p>No figures available.</p>";
      return;
    }

    container.innerHTML = "";
    for (const f of figures) {
      const card = document.createElement("article");
      card.className = "figure-card";

      const name = document.createElement("h3");
      name.className = "figure-name";
      name.textContent = f.id || "Untitled";

      const type = document.createElement("div");
      type.className = "figure-type";
      type.textContent = f.type || "";

      const bio = document.createElement("p");
      bio.className = "figure-bio";
      bio.textContent = f.bio || "";

      card.appendChild(name);
      card.appendChild(type);
      card.appendChild(bio);
      container.appendChild(card);
    }
  } catch (e) {
    console.error(e);
    container.innerHTML = "<p>Failed to load key figures.</p>";
  }
})();
