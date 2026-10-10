import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getAdminStore, updateStoreProfile } from "@/lib/admin.functions";
import { StorePageManager, type StoreDraft } from "@/components/admin/StorePageManager";
import { StoreMetaManager } from "@/components/admin/StoreMetaManager";
import { StorePaymentsManager } from "@/components/admin/StorePaymentsManager";
import { StoreWhatsappRecovery } from "@/components/admin/StoreWhatsappRecovery";

export const Route = createFileRoute("/_authenticated/admin/lojas/$id")({
  head: () => ({
    meta: [
      { title: "Editar loja | Administração" },
      { name: "description", content: "Edite cabeçalho, rodapé, perfil, políticas e checkout da loja." },
      { property: "og:title", content: "Editar loja" },
      { property: "og:description", content: "Edite cabeçalho, rodapé e checkout da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }: { error: unknown }) => <p className="p-6 text-center text-[14px] font-bold">{error instanceof Error ? error.message : "Erro ao carregar."}</p>,
  component: EditStore,
});

function EditStore() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const load = useServerFn(getAdminStore);
  const save = useServerFn(updateStoreProfile);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin-store", id], queryFn: () => load({ data: { id } }) });

  return (
    <main className="mx-auto max-w-[1000px] space-y-3 px-3 py-4">
      <Link to="/admin" search={{ aba: "lojas" }} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary">
        <ChevronLeft size={16} /> Todas as lojas
      </Link>
      {isLoading && <div className="grid min-h-[40vh] place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>}
      {error && <p className="text-[13px] font-bold">{error.message}</p>}
      {data && (
        <>
          <StorePageManager
            key={id}
            store={data.store as unknown as StoreDraft}
            products={data.products}
            onSave={async (draft) => {
              const { is_default: _d, ...rest } = draft as StoreDraft & { is_default?: boolean };
              const result = await save({ data: { ...(rest as never as object), id, checkout: { ...(draft.checkout ?? {}), checkout_model: draft.checkout?.checkout_model ?? "v1", logo_url: draft.checkout?.logo_url ?? null, primary_color: draft.checkout?.primary_color ?? "", title: draft.checkout?.title ?? "", note: draft.checkout?.note ?? "", verified_home: draft.checkout?.verified_home !== false, verified_product: draft.checkout?.verified_product !== false, verified_checkout: draft.checkout?.verified_checkout !== false, verified_footer: draft.checkout?.verified_footer !== false, display_name: draft.checkout?.display_name ?? "", show_name: draft.checkout?.show_name !== false, discount_title: draft.checkout?.discount_title ?? "", show_discount: draft.checkout?.show_discount !== false, legal_text: draft.checkout?.legal_text ?? "", show_legal: draft.checkout?.show_legal !== false } } as never });
              if (!result.ok) {
                toast.error(result.error);
                return false;
              }
              await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["admin-overview"] })]);
              return true;
            }}
          />
          <StoreMetaManager storeId={id} />
          <StorePaymentsManager storeId={id} />
          <StoreWhatsappRecovery storeId={id} />
        </>
      )}
    </main>
  );
}
