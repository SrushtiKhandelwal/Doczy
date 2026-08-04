import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONVERSION_LIST } from "@/lib/conversions";

export default function Navbar() {
  return (
    <div className="sticky top-4 z-50 mx-auto w-full max-w-6xl px-6 lg:px-10">
      <header className="flex h-15 items-center justify-between rounded-xl border border-border bg-background/90 px-6 shadow-sm backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <span className="text-[22px] font-bold tracking-tight text-foreground lowercase">
            doczy
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="gap-1.5" />}
          >
            Tools
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {CONVERSION_LIST.map((conv) => (
              <DropdownMenuItem
                key={conv.id}
                render={<Link href={`/convert/${conv.id}`} />}
              >
                {conv.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </div>
  );
}
