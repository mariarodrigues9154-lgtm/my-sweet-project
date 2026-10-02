import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Criar nova senha | Painel da loja" },
      { name: "description", content: "Defina uma nova senha para o painel da loja." },
      { property: "og:title", content: "Criar nova senha" },
      { property: "og:description", content: "Defina uma nova senha para o painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("O link expirou ou é inválido. Peça um novo em Esqueci minha senha.");
      return;
    }
    toast.success("Senha atualizada.");
    void navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl bg-card p-5 shadow-card-soft">
        <h1 className="text-[18px] font-extrabold">Criar nova senha</h1>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Nova senha</span>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-[13.5px] outline-none focus:border-primary" />
        </label>
        <button type="submit" disabled={busy} className="w-full rounded-full cta-gradient py-3 text-[14px] font-extrabold text-primary-foreground shadow-cta-glow disabled:opacity-60">
          Salvar nova senha
        </button>
      </form>
    </div>
  );
}
