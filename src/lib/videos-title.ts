import type { ProductSections } from "@/lib/product-types";

export type VideosTitleIcon = "video" | "play" | "camera" | "clapperboard" | "videotape";
export type VideosTitleIconPosition = "before" | "after" | "after_count";

const ICONS: VideosTitleIcon[] = ["video", "play", "camera", "clapperboard", "videotape"];
const POSITIONS: VideosTitleIconPosition[] = ["before", "after", "after_count"];

export type VideosTitleConfig = {
  /** Mostra "(7)" ao lado do título. Padrão: ligado (lojas antigas). */
  showCount: boolean;
  /** Ícone do título; null = sem ícone (desligado ou "none"). */
  icon: VideosTitleIcon | null;
  /** Posição do ícone: antes do título, depois do título ou depois da quantidade. */
  iconPosition: VideosTitleIconPosition;
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
  return {
    showCount: s.videos_show_count !== false,
    icon,
    iconPosition: POSITIONS.includes(rawPos as VideosTitleIconPosition) ? (rawPos as VideosTitleIconPosition) : "after",
  };
}
