import { useMemo, useState } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";

import { IMAGE_ACCEPT } from "@/lib/media-upload";
import { brl } from "@/lib/format";
import { allComboKeys, comboLabel, type VariantCombo, type VariantGroup } from "@/lib/product-types";

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] outline-none focus:border-primary";

function slug(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "opcao"
  );
}

function uniqueValue(base: string, taken: string[]) {
  let value = base;
  let i = 2;
  while (taken.includes(value)) value = `${base}-${i++}`;
  return value;
}

/**
 * Variações do produto: atributos livres (Cor, Numeração, Voltagem…) com imagem
 * por opção e preço/estoque/SKU por combinação. As chaves das combinações usam
 * os valores internos das opções, por isso editar um rótulo nunca apaga dados.
 */
export function VariantsEditor({
  groups,
  combos,
  price,
  previousPrice,
  onGroups,
  onCombos,
  uploadOne,
  uploading,
}: {
  groups: VariantGroup[];
  combos: VariantCombo[];
  price: number;
  previousPrice: number;
  onGroups: (next: VariantGroup[]) => void;
  onCombos: (next: VariantCombo[]) => void;
  uploadOne: (file: File, apply: (url: string) => void) => Promise<void>;
  uploading: boolean;
}) {
  const [newGroup, setNewGroup] = useState("");

  const keys = useMemo(() => allComboKeys(groups), [groups]);
  const rows = useMemo(
    () => keys.map((key) => combos.find((c) => c.key === key) ?? { key, active: true }),
    [keys, combos],
  );

  const patchCombo = (key: string, patch: Partial<VariantCombo>) => {
    const next = rows.map((row) => (row.key === key ? { ...row, ...patch } : row));
    onCombos(next);
  };

  const patchGroup = (index: number, patch: Partial<VariantGroup>) => {
    onGroups(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const addGroup = () => {
    const label = newGroup.trim();
    if (!label) return;
    const name = uniqueValue(slug(label), groups.map((g) => g.name));
    onGroups([...groups, { name, label, use_image: false, options: [] }]);
    setNewGroup("");
  };

  const removeGroup = (index: number) => {
    onGroups(groups.filter((_, i) => i !== index));
    onCombos([]);
  };

  const addOption = (index: number) => {
    const group = groups[index];
    if (!group) return;
    const value = uniqueValue("opcao", group.options.map((o) => o.value));
    patchGroup(index, { options: [...group.options, { label: "", value }] });
  };

  return (
    <div className="space-y-4">
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        Crie os atributos do produto (Cor, Numeração, Voltagem, Kit…). Cada opção pode ter imagem
        própria. Depois, defina preço, estoque e código de cada combinação — sem preço próprio, vale
        o preço principal do produto.
      </p>

      {groups.map((group, gi) => (
        <div key={group.name} className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <input
              value={group.label}
              placeholder="Nome do atributo (ex.: Cor)"
              onChange={(e) => patchGroup(gi, { label: e.target.value })}
              className={inputCls}
            />
            <button
              type="button"
              aria-label="Remover atributo"
              onClick={() => removeGroup(gi)}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-input text-muted-foreground"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <label className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
            <input
              type="checkbox"
              checked={group.use_image === true}
              onChange={(e) => patchGroup(gi, { use_image: e.target.checked })}
            />
            Mostrar como cartões com imagem
          </label>

          <div className="mt-3 space-y-2">
            {group.options.map((option, oi) => (
              <div key={option.value} className="flex items-center gap-2">
                {option.image ? (
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border">
                    <img src={option.image} alt="" className="size-full object-cover" />
                    <button
                      type="button"
                      aria-label="Remover imagem da opção"
                      onClick={() =>
                        patchGroup(gi, {
                          options: group.options.map((o, i) => (i === oi ? { ...o, image: null } : o)),
                        })
                      }
                      className="absolute right-0 top-0 grid size-4 place-items-center rounded-bl bg-foreground/70 text-background"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed border-input text-muted-foreground">
                    <ImagePlus size={15} />
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT}
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        void uploadOne(file, (url) =>
                          patchGroup(gi, {
                            options: group.options.map((o, i) => (i === oi ? { ...o, image: url } : o)),
                          }),
                        );
                      }}
                    />
                  </label>
                )}
                <input
                  value={option.label}
                  placeholder="Nome da opção (ex.: Preto)"
                  onChange={(e) =>
                    patchGroup(gi, {
                      options: group.options.map((o, i) => (i === oi ? { ...o, label: e.target.value } : o)),
                    })
                  }
                  className={inputCls}
                />
                <button
                  type="button"
                  aria-label="Remover opção"
                  onClick={() => patchGroup(gi, { options: group.options.filter((_, i) => i !== oi) })}
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-input text-muted-foreground"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addOption(gi)}
              className="flex items-center gap-1 text-[12px] font-medium text-primary"
            >
              <Plus size={13} /> Adicionar opção
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          value={newGroup}
          placeholder="Nova variação (ex.: Numeração)"
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addGroup();
            }
          }}
          className={inputCls}
        />
        <button
          type="button"
          onClick={addGroup}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"
        >
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[12.5px] font-medium">Combinações ({rows.length})</h4>
          {rows.map((row) => (
            <div key={row.key} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12.5px] font-medium">{comboLabel(groups, row.key)}</p>
                <label className="flex shrink-0 items-center gap-1 text-[11.5px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={row.active !== false}
                    onChange={(e) => patchCombo(row.key, { active: e.target.checked })}
                  />
                  Ativa
                </label>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NumField
                  label={`Preço (padrão ${brl(price)})`}
                  value={row.price}
                  onChange={(v) => patchCombo(row.key, { price: v })}
                />
                <NumField
                  label={`Preço original (padrão ${brl(previousPrice)})`}
                  value={row.previous_price}
                  onChange={(v) => patchCombo(row.key, { previous_price: v })}
                />
                <NumField
                  label="Estoque"
                  value={row.stock}
                  integer
                  onChange={(v) => patchCombo(row.key, { stock: v })}
                />
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Código (SKU)</span>
                  <input
                    value={row.sku ?? ""}
                    onChange={(e) => patchCombo(row.key, { sku: e.target.value })}
                    className={inputCls}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  integer = false,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  integer?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        value={value == null ? "" : String(value)}
        placeholder="—"
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".").trim();
          if (!raw) return onChange(null);
          const n = Number(raw);
          if (Number.isNaN(n) || n < 0) return;
          onChange(integer ? Math.round(n) : n);
        }}
        className={inputCls}
      />
    </label>
  );
}
