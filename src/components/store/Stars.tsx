import { Star } from "lucide-react";

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-[1px]" aria-label={`Nota ${rating} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = rating >= i + 0.75;
        const half = !filled && rating >= i + 0.25;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-border" strokeWidth={1.5} />
            {(filled || half) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled ? size : size / 2 }}
              >
                <Star size={size} className="fill-star text-star" strokeWidth={1.5} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
