import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso administrativo | Painel da loja" },
      { name: "description", content: "Entre para gerenciar produtos e pedidos da loja." },
      { property: "og:title", content: "Acesso administrativo" },
      { property: "og:description", content: "Painel de gestão da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/admin", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void navigate({ to: "/admin", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) toast.error("Não foi possível enviar o e-mail agora.");
        else toast.success("Enviamos um link para criar uma nova senha.");
        return;
      }
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error("E-mail ou senha inválidos.");
          return;
        }
        void navigate({ to: "/admin", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (data.session) {
          void navigate({ to: "/admin", replace: true });
        } else {
          toast.success("Confira seu e-mail para confirmar o cadastro.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-3 rounded-2xl bg-card p-5 shadow-card-soft"
      >
        <h1 className="text-[18px] font-extrabold">Painel da loja</h1>
        <p className="text-[12.5px] text-muted-foreground">
          {mode === "login" ? "Entre com sua conta de administrador." : mode === "signup" ? "Crie a conta de administrador. A primeira conta criada vira a administradora." : "Informe seu e-mail para receber o link de nova senha."}
        </p>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
          />
        </label>
        {mode !== "forgot" && <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Senha</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
          />
        </label>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full cta-gradient py-3 text-[14px] font-extrabold text-primary-foreground shadow-cta-glow disabled:opacity-60"
        >
          {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
        </button>
        {mode !== "forgot" && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth` });
              if (result.error) toast.error("Não foi possível entrar com o Google.");
            }}
            className="w-full rounded-full border border-border py-3 text-[13.5px] font-bold"
          >
            Entrar com Google
          </button>
        )}
        {mode === "login" && (
          <button type="button" onClick={() => setMode("forgot")} className="w-full text-[12px] font-semibold text-muted-foreground">
            Esqueci minha senha
          </button>
        )}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-[12.5px] font-bold text-primary"
        >
          {mode === "login" ? "Criar conta de administrador" : "Já tenho conta"}
        </button>
      </form>
    </div>
  );
}
