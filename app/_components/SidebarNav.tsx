"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  soon?: boolean;
  icon: React.ReactNode;
  /** Roles that can see this item. If undefined, all roles can see it. */
  roles?: string[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-5 w-5 items-center justify-center">{children}</span>;
}

const groups: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </Icon>
        ),
      },
    ],
  },
  {
    label: "Operaciones",
    items: [
      {
        href: "/recepcion",
        label: "Recepción",
        roles: ["Admin", "Gerente", "Recepcionista"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 7V5a4 4 0 0 1 8 0v2" />
              <path d="M6 7h12v14H6z" />
              <path d="M9 11h6M9 15h6" />
            </svg>
          </Icon>
        ),
      },
      {
        href: "/asistencias",
        label: "Asistencias",
        roles: ["Admin", "Gerente", "Recepcionista"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
            </svg>
          </Icon>
        ),
      },
      {
        href: "/casilleros",
        label: "Casilleros",
        roles: ["Admin", "Gerente", "Recepcionista"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </Icon>
        ),
      },
    ],
  },
  {
    label: "Gestión",
    items: [
      {
        href: "/socios",
        label: "Socios",
        roles: ["Admin", "Gerente", "Recepcionista"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="7" r="4" />
              <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
          </Icon>
        ),
      },
      {
        href: "/planes",
        label: "Planes",
        roles: ["Admin", "Gerente", "Recepcionista"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </Icon>
        ),
      },
      {
        href: "/pagos",
        label: "Pagos",
        roles: ["Admin", "Gerente", "Recepcionista"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="13" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 14h2M10 14h2" />
            </svg>
          </Icon>
        ),
      },
      {
        href: "/caja",
        label: "Caja",
        roles: ["Admin", "Gerente", "Recepcionista"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="13" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 14h2M10 14h2" />
            </svg>
          </Icon>
        ),
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        href: "/retencion",
        label: "Retención",
        roles: ["Admin", "Gerente"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
            </svg>
          </Icon>
        ),
      },
      {
        href: "/campanas",
        label: "Campañas",
        roles: ["Admin", "Gerente"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7Z" />
            </svg>
          </Icon>
        ),
      },
    ],
  },
  {
    label: "Inteligencia",
    items: [
      {
        href: "/analytics",
        label: "BI & Analytics",
        roles: ["Admin", "Gerente"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M7 16l4-8 4 4 4-8" />
            </svg>
          </Icon>
        ),
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        href: "/auditoria",
        label: "Auditoría",
        roles: ["Admin"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </Icon>
        ),
      },
      {
        href: "/configuracion",
        label: "Configuración",
        roles: ["Admin"],
        icon: (
          <Icon>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </Icon>
        ),
      },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const roleName = user?.rol?.nombre || "";

  return (
    <nav className="space-y-5">
      {groups.map((group) => {
        // Filter items based on role
        const visibleItems = group.items.filter((item) => {
          if (!item.roles) return true; // No restriction
          if (!roleName) return true; // No role info, show all (fallback)
          return item.roles.includes(roleName);
        });

        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.soon ? "#" : item.href}
                    aria-disabled={item.soon}
                    onClick={item.soon ? (e) => e.preventDefault() : undefined}
                    className={[
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150 border",
                      item.soon
                        ? "border-transparent text-slate-600 cursor-default select-none"
                        : active
                        ? "border-brand-green/20 bg-brand-green/8 text-slate-50"
                        : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "transition-colors shrink-0",
                        item.soon
                          ? "text-slate-700"
                          : active
                          ? "text-brand-green"
                          : "text-slate-500 group-hover:text-brand-green",
                      ].join(" ")}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {item.soon ? (
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                        Pronto
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
