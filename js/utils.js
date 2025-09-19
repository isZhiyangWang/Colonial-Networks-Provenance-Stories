
export const $ = (id) => document.getElementById(id);
export const $q = (sel) => document.querySelector(sel);
export const setText = (id, text) => { const el = $(id); if (el) el.textContent = text ?? ""; };
export const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html ?? ""; };
export const px = (n) => `${n}px`;

export function getFilenameBase(url = "") {
  const parts = url.split("/");
  const filename = parts[parts.length - 1] || "";
  return filename.replace(/\.[^.]+$/, "");
}
