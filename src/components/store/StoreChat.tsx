import { useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

import type { StoreSettings } from "@/lib/product-types";

export function StoreChat({ store, open, onClose }: { store: StoreSettings; open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-3" onClick={onClose}>
      <section className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-card shadow-sheet-up" onClick={(e) => e.stopPropagation()}>
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
          <span className="grid size-9 place-items-center rounded-full bg-success-soft text-success"><MessageCircle size={18} /></span>
          <div className="min-w-0"><p className="truncate text-[13.5px] font-bold">{store.name}</p><p className="text-[11px] text-success">Atendimento online</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar conversa" className="grid size-8 place-items-center"><X size={18} /></button>
        </header>
        <div className="min-h-52 space-y-2 bg-surface p-4">
          <p className="max-w-[82%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-[12.5px] shadow-card-soft">Olá! Como podemos ajudar com este produto?</p>
          {sent.map((text, i) => <p key={`${text}-${i}`} className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-[12.5px] text-primary-foreground">{text}</p>)}
          {sent.length > 0 && <p className="max-w-[82%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-[12.5px] shadow-card-soft">Recebemos sua mensagem. Nossa equipe responderá assim que possível.</p>}
        </div>
        <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); if (!message.trim()) return; setSent((s) => [...s, message.trim()]); setMessage(""); }}>
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite sua mensagem" className="min-w-0 rounded-full border border-input bg-card px-4 py-2 text-[13px] outline-none focus:border-primary" />
          <button type="submit" aria-label="Enviar mensagem" className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground"><Send size={16} /></button>
        </form>
      </section>
    </div>
  );
}