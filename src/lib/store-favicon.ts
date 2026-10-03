import { useEffect } from "react";

export const DEFAULT_FAVICON = "/favicon.png";

/** Aplica o favicon da loja na aba do navegador; sem favicon, usa o padrão do site. */
export function useStoreFavicon(url: string | null | undefined) {
  useEffect(() => {
    const href = url || DEFAULT_FAVICON;
    const type = /\.ico(\?|$)/i.test(href) ? "image/x-icon" : /\.svg(\?|$)/i.test(href) ? "image/svg+xml" : "image/png";
    let links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    if (!links.length) {
      const l = document.createElement("link");
      l.rel = "icon";
      document.head.appendChild(l);
      links = [l];
    }
    for (const l of links) {
      l.href = href;
      if (url) l.removeAttribute("type"); else l.type = type;
    }
  }, [url]);
}
