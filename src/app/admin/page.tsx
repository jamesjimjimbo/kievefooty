import type { Metadata } from "next";import { redirect } from "next/navigation";import { AppShell } from "@/components/app-shell";import { CalendarCog,ClipboardList,Coins,Gauge,Swords,WandSparkles } from "lucide-react";import { createClient } from "@/lib/supabase/server";
export const metadata:Metadata={title:"Admin"};export const dynamic="force-dynamic";
export default async function Page(){
 const supabase=await createClient();if(!supabase)redirect("/auth/sign-in");const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
 const {data:profile}=await supabase.from("profiles").select("is_admin").eq("id",user.id).single();if(!profile?.is_admin)redirect("/picks");
 const [{count:weeks},{count:fixtures},{count:ledger},{count:challenges},{count:players},{count:submitted}]=await Promise.all([
  supabase.from("competition_weeks").select("*",{count:"exact",head:true}),supabase.from("fixtures").select("*",{count:"exact",head:true}),
  supabase.from("points_ledger").select("*",{count:"exact",head:true}),supabase.from("challenges").select("*",{count:"exact",head:true}),
  supabase.from("profiles").select("*",{count:"exact",head:true}),supabase.from("weekly_submissions").select("*",{count:"exact",head:true}),
 ]);
 const tools=[{name:"Competition weeks",text:`${weeks??0} scripted weeks`,Icon:CalendarCog},{name:"Fixtures & odds",text:`${fixtures??0} fixtures loaded`,Icon:ClipboardList},{name:"Auto-picks",text:`${submitted??0} weekly submissions`,Icon:WandSparkles},{name:"Settlement",text:"Enter results and settle once",Icon:Gauge},{name:"Ledger",text:`${ledger??0} recorded movements`,Icon:Coins},{name:"Challenges",text:`${challenges??0} directional challenges`,Icon:Swords}];
 return <AppShell><main className="content content-wide"><div className="page-head"><div><p className="eyebrow">Restricted</p><h1>Admin desk</h1><p className="subtle">Live controls for the Kieve Footy competition.</p></div><span className="pill live">Admin</span></div>
 <div className="notice" style={{marginBottom:18}}><b>{players??0} registered players.</b> Admin access is verified server-side on every request.</div>
 <section className="admin-grid">{tools.map(({name,text,Icon})=><article className="card admin-card" key={name}><div><span className="icon-box"><Icon size={21}/></span><h3>{name}</h3><p>{text}</p></div><button className="secondary" style={{marginTop:16}}>Open</button></article>)}</section>
 </main></AppShell>
}
