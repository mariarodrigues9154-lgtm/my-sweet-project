import type React from "react";

/** Cor principal do checkout definida por loja (formato #RRGGBB). */
export function checkoutTheme(store: { checkout?: { primary_color?: string | null } | null }): React.CSSProperties | undefined {
  const color = store.checkout?.primary_color;
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return undefined;
  return { ["--primary" as string]: color } as React.CSSProperties;
}
