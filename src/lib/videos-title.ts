import type { ProductSections } from "@/lib/product-types";

export type VideosTitleIcon = "video" | "play" | "camera" | "clapperboard" | "videotape";
export type VideosTitleIconPosition = "before" | "after" | "after_count";

const ICONS: VideosTitleIcon[] = ["video", "play", "camera", "clapperboard", "videotape"];
const POSITIONS: VideosTitleIconPosition[] = ["before", "after", "after_count"];

/** Aceita apenas hex seguro (#rgb, #rrggbb, #rrggbbaa); qualquer outro valor cai na cor padrão. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export type VideosTitleConfig = {
  /** Mostra "(7)" ao lado do título. Padrão: ligado (lojas antigas). */
  showCount: boolean;
  /** Ícone do título; null = sem ícone (desligado ou "none"). */
  icon: VideosTitleIcon | null;
  /** Posição do ícone: antes do título, depois do título ou depois da quantidade. */
  iconPosition: VideosTitleIconPosition;
  /** Cor do título e do ícone (hex); null = cor padrão do tema. */
  color: string | null;
};

/** Resolve a configuração do título da seção de vídeos (por produto). */
export function resolveVideosTitle(sections: ProductSections | undefined): VideosTitleConfig {
  const s = sections ?? {};
  const rawIcon = s.videos_title_icon;
  const icon: VideosTitleIcon | null =
    s.videos_title_show_icon === true && rawIcon !== "none"
      ? ICONS.includes(rawIcon as VideosTitleIcon)
        ? (rawIcon as VideosTitleIcon)
        : "video"
      : null;
  const rawPos = s.videos_title_icon_position;
  const rawColor = s.videos_title_color?.trim();
  return {
    showCount: s.videos_show_count !== false,
    icon,
    iconPosition: POSITIONS.includes(rawPos as VideosTitleIconPosition) ? (rawPos as VideosTitleIconPosition) : "after",
    color: rawColor && HEX.test(rawColor) ? rawColor : null,
  };
}
