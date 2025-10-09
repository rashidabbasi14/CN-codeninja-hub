"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Calendar, 
  Building2, 
  Shield, 
  Settings,
  Clock
} from "lucide-react";

const adminNavItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Events", href: "/admin/events", icon: Calendar },
  { name: "Departments", href: "/admin/departments", icon: Building2 },
  { name: "Moderation", href: "/admin/moderation", icon: Shield },
];

export default function AdminNavbar() {
  const pathname = usePathname();
  
  return (
    <nav className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-evenly py-2">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}