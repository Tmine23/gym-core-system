import Link from "next/link";
import { SidebarNav } from "./SidebarNav";
import { AforoWidget } from "./AforoWidget";

export function Sidebar() {
  return (
    <aside className="w-72 shrink-0 border-r border-[#1e293b] bg-[#020617]">
      <div className="h-full flex flex-col">
        <div className="px-5 py-5 border-b border-[#1e293b]">
          <div className="section-kicker">Body Xtreme</div>
          <Link href="/" className="mt-1 block text-xl font-bold tracking-tight text-slate-100">
            Gym OS
          </Link>
        </div>

        <div className="flex-1 px-3 py-4">
          <SidebarNav />
        </div>

        <div className="px-4 py-4 border-t border-[#1e293b]">
          <AforoWidget current={42} capacity={120} />
        </div>
      </div>
    </aside>
  );
}

