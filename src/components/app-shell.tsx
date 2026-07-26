"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ListChecks, Trophy, UserRound } from "lucide-react";
const nav = [
  {href:"/picks",label:"Picks",Icon:ListChecks},{href:"/standings",label:"Standings",Icon:Trophy},
  {href:"/season",label:"Season",Icon:CalendarDays},{href:"/profile",label:"Profile",Icon:UserRound},
];
export function AppShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const navigation=<nav className="bottom-nav" aria-label="Primary navigation">{nav.map(({href,label,Icon})=>
    <Link key={href} href={href} className={`nav-item ${pathname.startsWith(href)?"active":""}`}>
      <Icon size={20} strokeWidth={2.3}/><span>{label}</span><i className="nav-dot"/>
    </Link>)}</nav>;
  return <div className="app-shell"><header className="topbar"><div className="topbar-inner">
    <Link href="/picks" className="wordmark"><span className="ball-mark">⚽</span>Kieve Footy</Link>
    {navigation}<div className="top-actions"><Link className="admin-link" href="/admin">Admin</Link><span className="avatar">JM</span></div>
  </div></header>{children}<div className="mobile-only">{navigation}</div></div>;
}
