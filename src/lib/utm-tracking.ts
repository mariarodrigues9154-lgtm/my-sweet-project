/** Captura e preserva src/sck/UTMs da URL durante toda a navegação e o checkout. */
import { useEffect } from "react";

import { getStoreUtmifyScripts } from "./utmify.functions";

export const TRACKING_KEYS = ["src", "sck", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"] as const;
export type TrackingParams = Partial<Record<(typeof TRACKING_KEYS)[number], string>>;

const KEY = "utm:tracking";
const TTL = 30 * 86400_000;

/** Guarda os parâmetros da URL atual (último clique vence). */
export function captureTracking() {
  if (typeof window === "undefined") return;
  const url = new URLSearchParams(window.location.search);
  const found: TrackingParams = {};
  for (const k of TRACKING_KEYS) { const v = url.get(k); if (v) found[k] = v.slice(0, 500); }
  if (Object.keys(found).length) {
    try { window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), params: found })); } catch { /* sem storage */ }
  }
}

export function readTracking(): TrackingParams {
  if (typeof window === "undefined") return {};
  captureTracking();
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as { at: number; params: TrackingParams } | null;
    if (!raw || Date.now() - raw.at > TTL) return {};
    return raw.params ?? {};
  } catch { return {}; }
}

export function useCaptureTracking() {
  useEffect(() => { captureTracking(); }, []);
}

const loaded = new Set<string>();
function addScript(src: string, attrs: Record<string, string> = {}) {
  if (loaded.has(src) || document.querySelector(`script[src="${src}"]`)) return;
  loaded.add(src);
  const s = document.createElement("script");
  s.src = src; s.async = true; s.defer = true;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
}

let requested: string | null = null;
/** Carrega uma única vez os scripts oficiais da UTMify configurados para a loja. */
export function useUtmifyScripts(storeId: string | null | undefined) {
  useEffect(() => {
    if (!storeId || requested === storeId) return;
    requested = storeId;
    void getStoreUtmifyScripts({ data: { store_id: storeId } }).then((cfg) => {
      if (!cfg) return;
      if (cfg.utm_script_src) addScript(cfg.utm_script_src, { "data-utmify-prevent-xcod-sck": "", "data-utmify-prevent-subids": "" });
      if (cfg.pixel_script_src && cfg.pixel_id) {
        (window as unknown as { pixelId?: string }).pixelId = cfg.pixel_id;
        addScript(cfg.pixel_script_src);
      }
    }).catch(() => undefined);
  }, [storeId]);
}
