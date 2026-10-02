import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-surface pb-10">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/admin" className="text-[16px] font-extrabold">Administração</Link>
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">{user.email}</span>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] font-bold"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
