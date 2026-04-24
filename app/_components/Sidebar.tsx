import Link from "next/link";
import { SidebarNav } from "./SidebarNav";

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

        <div className="flex-1 px-3 py-4 overflow-y-auto">
          <SidebarNav />
        </div>
      </div>
    </aside>
  );
}
