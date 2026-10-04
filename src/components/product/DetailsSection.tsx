import type { DescriptionBlock, Product } from "@/lib/product-types";

export function SpecsSection({ product }: { product: Product }) {
  if (!product.specs.length && !product.description.length) return null;
  return (
    <section className="mt-2 bg-card px-4 py-4">
      <h2 className="text-[15px] font-extrabold">{product.sections?.about_title || "Sobre este produto"}</h2>
      {product.specs.length > 0 && <h3 className="mt-3 text-[13px] font-bold">Detalhes</h3>}
      <dl className="mt-2">
        {product.specs.map((s) => (
          <div key={s.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3 py-1.5">
            <dt className="text-[12.5px] text-muted-foreground">{s.label}</dt>
            <dd className="text-[12.5px] font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      {product.warranty && (
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {product.warranty}
        </p>
      )}
      {product.description.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <h3 className="text-[13px] font-bold">{product.sections?.description_title || "Descrição do Produto"}</h3>
          <div className="mt-2 space-y-3">{product.description.map((block, i) => <Block key={i} block={block} />)}</div>
        </div>
      )}
    </section>
  );
}

export function Block({ block }: { block: DescriptionBlock }) {
  switch (block.type) {
    case "heading":
      return <h3 className="pt-1 text-[14px] font-extrabold">{block.text}</h3>;
    case "subheading":
      return <h4 className="text-[13px] font-bold">{block.text}</h4>;
    case "paragraph":
      return <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground/90"><RichText text={block.text} /></p>;
    case "spacer":
      return <div aria-hidden className={block.size === "lg" ? "h-8" : block.size === "sm" ? "h-1" : "h-4"} />;
    case "list":
      return (
        <ul className="space-y-1.5">
          {block.items.map((item) => (
            <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-foreground/90">
              <span className="mt-[2px] font-bold text-primary">•</span>
              <span><RichText text={item} /></span>
            </li>
          ))}
        </ul>
      );
    case "image":
      return (
        <figure>
          <img src={block.url} alt={block.alt ?? ""} loading="lazy" decoding="async" className="h-auto w-full rounded-xl object-contain" />
          {block.caption && <figcaption className="mt-1 text-center text-[11.5px] text-muted-foreground">{block.caption}</figcaption>}
        </figure>
      );
    case "video":
      return (
        <video
          src={block.url}
          poster={block.poster}
          controls
          playsInline
          preload="none"
          className="w-full rounded-xl border border-border"
        />
      );
    default:
      return null;
  }
}

/** Negrito com **texto**. */
function RichText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part))}</>;
}

/** Termos da loja (store.checkout.product_terms); sem texto da loja, usa o texto antigo do produto. */
export function TermsSection({ terms, config }: { terms: string | null; config?: { enabled?: boolean; title?: string; text?: string } }) {
  if (config?.enabled === false) return null;
  const text = config?.text?.trim() ? config.text : terms;
  if (!text?.trim()) return null;
  return (
    <section className="mt-2 bg-card px-4 py-4">
      <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-muted-foreground">{config?.title?.trim() || "Termos"}</h2>
      <p className="mt-2 whitespace-pre-line text-[11.5px] leading-relaxed text-muted-foreground">{text}</p>
    </section>
  );
}
