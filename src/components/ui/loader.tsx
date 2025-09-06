import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Loader = ({ className, text }: { className?: string, text?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Loader2 className={cn("h-8 w-8 animate-spin text-primary", className)} />
      {text && <p className="text-muted-foreground">{text}</p>}
    </div>
  );
};
