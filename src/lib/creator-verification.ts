import type { CreatorVideo } from "@/lib/product-types";

/** Vídeos antigos preservam o verde; desligar prevalece sobre qualquer estilo. */
export function resolveCreatorVerification(video: Pick<CreatorVideo, "verified" | "verified_style">) {
  if (video.verified !== true) return null;
  return video.verified_style === "blue" ? "blue" : "green";
}