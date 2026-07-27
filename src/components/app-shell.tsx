"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, ListChecks, Trophy, UserRound } from "lucide-react";
import { useEffect,useState } from "react";
import { createClient } from "@/lib/supabase/client";
const nav = [
  {href:"/picks",label:"Picks",Icon:ListChecks},{href:"/standings",label:"Standings",Icon:Trophy},
  {href:"/season",label:"Season",Icon:CalendarDays},{href:"/profile",label:"Profile",Icon:UserRound},
];
export function AppShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const [initials,setInitials]=useState("KF");
  const [isAdmin,setIsAdmin]=useState(false);
  useEffect(()=>{const supabase=createClient();void supabase.auth.getUser().then(async({data})=>{
    if(!data.user)return;const {data:profile}=await supabase.from("profiles").select("display_name,is_admin").eq("id",data.user.id).maybeSingle();
    const name=profile?.display_name??data.user.email??"KF";setInitials(name.split(/\s+/).map((part:string)=>part[0]).join("").slice(0,2).toUpperCase());setIsAdmin(Boolean(profile?.is_admin));
  })},[]);
  const navigation=<nav className="bottom-nav" aria-label="Primary navigation">{nav.map(({href,label,Icon})=>
    <Link key={href} href={href} className={`nav-item ${pathname.startsWith(href)?"active":""}`}>
      <Icon size={20} strokeWidth={2.3}/><span>{label}</span><i className="nav-dot"/>
    </Link>)}</nav>;
  return <div className="app-shell"><header className="topbar"><div className="topbar-inner">
    <Link href="/picks" className="wordmark"><span className="ball-mark">⚽</span>Kieve Footy</Link>
    {navigation}<div className="top-actions"><Link className="rules-link" href="/rules"><BookOpen size={16}/><span>Rules</span></Link>{isAdmin&&<Link className="admin-link" href="/admin">Admin</Link>}<Link href="/profile" className="avatar" aria-label="Open profile">{initials}</Link></div>
  </div></header>{children}<div className="mobile-only">{navigation}</div></div>;
}
