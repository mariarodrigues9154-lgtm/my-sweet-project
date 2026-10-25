import { describe, expect, it } from "vitest";

import { resolveVideosTitle } from "@/lib/videos-title";

describe("resolveVideosTitle", () => {
  it("produto antigo: quantidade ligada e sem ícone", () => {
    expect(resolveVideosTitle({})).toEqual({ showCount: true, icon: null, iconPosition: "after" });
    expect(resolveVideosTitle(undefined).showCount).toBe(true);
  });

  it("quantidade pode ser desativada", () => {
    expect(resolveVideosTitle({ videos_show_count: false }).showCount).toBe(false);
  });

  it("ícone só aparece com o controle ligado", () => {
    expect(resolveVideosTitle({ videos_title_icon: "play" }).icon).toBeNull();
    expect(resolveVideosTitle({ videos_title_show_icon: true, videos_title_icon: "play" }).icon).toBe("play");
  });

  it("ícone ligado sem tipo cai no padrão vídeo", () => {
    expect(resolveVideosTitle({ videos_title_show_icon: true }).icon).toBe("video");
  });

  it("tipo 'none' esconde o ícone mesmo ligado", () => {
    expect(resolveVideosTitle({ videos_title_show_icon: true, videos_title_icon: "none" }).icon).toBeNull();
  });

  it("tipo desconhecido cai no padrão vídeo", () => {
    expect(resolveVideosTitle({ videos_title_show_icon: true, videos_title_icon: "emoji" as never }).icon).toBe("video");
  });

  it("posição desconhecida cai no padrão depois do título", () => {
    const r = resolveVideosTitle({ videos_title_show_icon: true, videos_title_icon_position: "lado" as never });
    expect(r.iconPosition).toBe("after");
  });

  it("posição depois da quantidade é respeitada", () => {
    const r = resolveVideosTitle({ videos_title_show_icon: true, videos_title_icon_position: "after_count" });
    expect(r.iconPosition).toBe("after_count");
  });

  it("sem cor configurada usa a cor padrão do tema", () => {
    expect(resolveVideosTitle({}).color).toBeNull();
    expect(resolveVideosTitle({ videos_title_color: "  " }).color).toBeNull();
  });

  it("cor hex válida é aplicada ao título e ao ícone", () => {
    expect(resolveVideosTitle({ videos_title_color: "#ff0000" }).color).toBe("#ff0000");
    expect(resolveVideosTitle({ videos_title_color: "#f0f" }).color).toBe("#f0f");
  });

  it("cor inválida cai na cor padrão (sem injeção de CSS)", () => {
    expect(resolveVideosTitle({ videos_title_color: "red" }).color).toBeNull();
    expect(resolveVideosTitle({ videos_title_color: "url(x)" }).color).toBeNull();
    expect(resolveVideosTitle({ videos_title_color: "#zzz" }).color).toBeNull();
  });
});
