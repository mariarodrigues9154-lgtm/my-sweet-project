import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { adminCustomerPhone } from "@/lib/admin-customer-phone";

async function copyPhone(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.className = "fixed left-0 top-0 opacity-0";
      document.body.appendChild(input);
      try {
        input.select();
        input.setSelectionRange(0, value.length);
        if (!document.execCommand("copy")) throw new Error("copy failed");
      } finally { input.remove(); }
    }
    toast.success("Número copiado!");
  } catch { toast.error("Não foi possível copiar o número. Tente novamente."); }
}

export function CustomerPhone({ phone }: { phone: string }) {
  const contact = adminCustomerPhone(phone);
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <span className="whitespace-nowrap tnum">{contact.display}</span>
        {contact.canCopy && <Tooltip>
          <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label="Copiar número" onClick={() => void copyPhone(contact.raw)}><Copy /></Button></TooltipTrigger>
          <TooltipContent>Copiar número</TooltipContent>
        </Tooltip>}
        {contact.whatsappUrl && <Tooltip>
          <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-success" asChild><a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp"><MessageCircle /></a></Button></TooltipTrigger>
          <TooltipContent>Abrir WhatsApp</TooltipContent>
        </Tooltip>}
      </div>
    </TooltipProvider>
  );
}