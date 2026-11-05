import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BrasiliaClockProps = {
  className?: string;
};

const TIME_ZONE = "America/Sao_Paulo";

function formatBrasilia(now: Date) {
  // Exibe no padrão BR, sempre no fuso de Brasília (America/Sao_Paulo)
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function BrasiliaClock({ className }: BrasiliaClockProps) {
  const formatter = useMemo(() => formatBrasilia, []);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Badge
      variant="secondary"
      className={cn(
        "hidden sm:inline-flex h-8 items-center gap-2 rounded-full border-0 bg-ink-50 px-3 text-[13px] font-medium text-ink-600",
        className,
      )}
      title="Horário exibido no fuso de Brasília"
    >
      <Clock className="h-3.5 w-3.5 text-ink-400" />
      <span className="truncate">Brasília: {formatter(now)}</span>
    </Badge>
  );
}
