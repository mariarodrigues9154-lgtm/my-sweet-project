import { Check } from "lucide-react";
import { VerifiedBadge } from "@/components/store/VerifiedBadge";
import { resolveCreatorVerification } from "@/lib/creator-verification";
import type { CreatorVideo } from "@/lib/product-types";

export function CreatorVerification({ video, size }: { video: CreatorVideo; size: number }) {
  const style = resolveCreatorVerification(video);
  if (!style) return null;
  if (style === "blue") return <VerifiedBadge size={size} label="Criador verificado" />;
  return <Check size={size} strokeWidth={3} className="shrink-0 text-success" aria-label="Criador verificado" />;
}