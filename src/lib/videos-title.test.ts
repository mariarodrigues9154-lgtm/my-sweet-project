import { describe, expect, it } from "vitest";

import { resolveVideosTitle, videosTitleSchema } from "@/lib/videos-title";

describe("salvamento dos campos existentes do título", () => {
  const reload = (input: unknown) => JSON.parse(JSON.stringify(videosTitleSchema.parse(input)));

  it("mantém o checkbox ativado após validar e recarregar", () => {
    expect(reload({ videos_title_show_icon: true }).videos_title_show_icon).toBe(true);
  });

  it("mantém o checkbox desativado e não renderiza ícone", () => {
    const saved = reload({ videos_title_show_icon: false, videos_title_icon: "play" });
    expect(saved.videos_title_show_icon).toBe(false);
    expect(resolveVideosTitle(saved).icon).toBeNull();
  });

  it.each(["video", "play", "camera", "clapperboard", "videotape"] as const)("preserva e resolve o ícone %s", (icon) => {
    const saved = reload({ videos_title_show_icon: true, videos_title_icon: icon });
    expect(saved.videos_title_icon).toBe(icon);
    expect(resolveVideosTitle(saved).icon).toBe(icon);
  });

  it.each(["before", "after", "after_count"] as const)("preserva a posição %s", (position) => {
    const saved = reload({ videos_title_show_icon: true, videos_title_icon_position: position });
    expect(resolveVideosTitle(saved).iconPosition).toBe(position);
  });

  it("mantém produtos independentes", () => {
    const a = reload({ videos_title_show_icon: true, videos_title_icon: "camera" });
    const b = reload({ videos_title_show_icon: false, videos_title_icon: "play" });
    expect(resolveVideosTitle(a).icon).toBe("camera");
    expect(resolveVideosTitle(b).icon).toBeNull();
  });

  it("preserva a cor já configurada e permite desligá-la", () => {
    expect(reload({ videos_title_color: "#ff0000" }).videos_title_color).toBe("#ff0000");
    expect(reload({ videos_title_color: undefined })).not.toHaveProperty("videos_title_color");
  });

  it("não inventa defaults ao carregar produto antigo", () => {
    expect(reload({})).toEqual({});
  });
});

describe("resolveVideosTitle", () => {
  it("produto antigo: quantidade ligada e sem ícone", () => {
    expect(resolveVideosTitle({})).toEqual({ showCount: true, icon: null, iconPosition: "after", color: null });
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

  it("preserva a cor hex personalizada do ícone", () => {
    expect(resolveVideosTitle({ videos_title_color: "#ff0000" }).color).toBe("#ff0000");
    expect(resolveVideosTitle({ videos_title_color: "#f0f" }).color).toBe("#f0f");
  });

  it("cor inválida cai na cor padrão (sem injeção de CSS)", () => {
    expect(resolveVideosTitle({ videos_title_color: "red" }).color).toBeNull();
    expect(resolveVideosTitle({ videos_title_color: "url(x)" }).color).toBeNull();
    expect(resolveVideosTitle({ videos_title_color: "#zzz" }).color).toBeNull();
  });
});
