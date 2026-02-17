(async function () {
  const container = document.getElementById("figures-container");
  if (!container) return;

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to fetch ${url} (${resp.status})`);
    return resp.json();
  }

  function s(v) {
    return typeof v === "string" ? v : "";
  }

  function buildCaption(imgData) {
    const cap = document.createElement("figcaption");
    cap.className = "kf-caption";

    const work = s(imgData?.work);
    const sourcePrefix = s(imgData?.sourcePrefix);
    const sourceName = s(imgData?.sourceName);
    const sourceUrl = s(imgData?.sourceUrl);
    const sourceSuffix = s(imgData?.sourceSuffix);

    if (work) cap.appendChild(document.createTextNode(work));
    if (sourcePrefix) cap.appendChild(document.createTextNode(sourcePrefix));

    if (sourceName) {
      if (sourceUrl) {
        const a = document.createElement("a");
        a.href = sourceUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = sourceName;
        cap.appendChild(a);
      } else {
        cap.appendChild(document.createTextNode(sourceName));
      }
    }

    if (sourceSuffix) cap.appendChild(document.createTextNode(sourceSuffix));

    return cap;
  }

  try {
    const figures = await fetchJson("data/key-figures.json");
    if (!Array.isArray(figures) || figures.length === 0) {
      container.innerHTML = "<p>No figures available.</p>";
      return;
    }

    container.innerHTML = "";

    for (const f of figures) {
      const card = document.createElement("article");
      card.className = "kf-card";

      const title = document.createElement("h2");
      title.className = "kf-title";
      title.textContent = s(f?.name) || "Untitled";

      const body = document.createElement("div");
      body.className = "kf-body";

      const left = document.createElement("div");
      left.className = "kf-left";

      const dates = document.createElement("div");
      dates.className = "kf-dates";
      dates.textContent = s(f?.dates);

      const imgData = f?.image || {};
      const shape = String(imgData?.shape || "rect").trim().toLowerCase();

      const figure = document.createElement("figure");
      figure.className = "kf-figure";

      const media = document.createElement("div");
      media.className = `kf-media ${shape === "oval" ? "kf-media--oval" : ""}`.trim();

      const img = document.createElement("img");
      img.src = s(imgData?.src);
      img.alt = s(imgData?.work);
      media.appendChild(img);

      figure.appendChild(media);
      figure.appendChild(buildCaption(imgData));

      left.appendChild(dates);
      left.appendChild(figure);

      const text = document.createElement("div");
      text.className = "kf-text";
      text.textContent = s(f?.text);

      body.appendChild(left);
      body.appendChild(text);

      card.appendChild(title);
      card.appendChild(body);

      container.appendChild(card);
    }
  } catch (e) {
    console.error(e);
    container.innerHTML = "<p>Failed to load key figures.</p>";
  }
})();
