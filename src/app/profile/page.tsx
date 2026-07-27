import type { Metadata } from "next";import { redirect } from "next/navigation";import { AppShell } from "@/components/app-shell";import { ClubCrest } from "@/components/club-crest";import { createClient } from "@/lib/supabase/server";import { updatePreferences } from "./actions";
export const metadata:Metadata={title:"Profile"};export const dynamic="force-dynamic";
export default async function Page(){
 const supabase=await createClient();if(!supabase)redirect("/auth/sign-in");const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
 const [{data:profile},{data:prefs},{data:ledger},{count:opponents},{count:used}]=await Promise.all([
  supabase.from("profiles").select("display_name,email,is_admin").eq("id",user.id).single(),
  supabase.from("email_preferences").select("*").eq("user_id",user.id).maybeSingle(),
  supabase.from("points_ledger").select("amount").eq("user_id",user.id),
  supabase.from("profiles").select("*",{count:"exact",head:true}).neq("id",user.id),
  supabase.from("challenges").select("*",{count:"exact",head:true}).eq("challenger_id",user.id),
 ]);
 const name=profile?.display_name??user.email?.split("@")[0]??"Player";const balance=(ledger??[]).reduce((s,row)=>s+Number(row.amount),0);
 const settings=[["new_week","New week opens",prefs?.new_week??true],["deadline_reminder","Deadline reminders",prefs?.deadline_reminder??true],["challenge_notification","Challenge notifications",prefs?.challenge_notification??true],["weekly_results","Weekly results",prefs?.weekly_results??false]] as const;
 return <AppShell><main className="content"><div className="page-head"><div><p className="eyebrow">Your clubhouse</p><h1>Profile</h1></div></div>
 <section className="card profile-identity"><ClubCrest seed={user.id} label={name} size="lg"/><div><p className="eyebrow">Your club</p><h2>{name}</h2><p className="subtle">{profile?.email??user.email}{profile?.is_admin?" · Admin":""}</p></div><span className="pill">Crest assigned</span></section>
 <div className="grid-2" style={{marginTop:14}}><section className="card"><p className="eyebrow">Bankroll</p><h1 style={{margin:0}}>{balance}</h1><p className="subtle">Available points</p></section><section className="card"><p className="eyebrow">Challenge tokens</p><h1 style={{margin:0}}>{Math.max(0,(opponents??0)-(used??0))}</h1><p className="subtle">Opponents remaining</p></section></div>
 <form action={updatePreferences} className="card" style={{marginTop:14}}><h2>Emails</h2>{settings.map(([key,label,checked])=><label className="setting" key={key}><span><b>{label}</b><small className="subtle" style={{display:"block"}}>Keep me in the loop</small></span><input name={key} type="checkbox" defaultChecked={checked} style={{width:22,height:22}}/></label>)}<button className="secondary" style={{marginTop:14}}>Save preferences</button></form>
 <a href="/auth/sign-out" className="secondary" style={{display:"grid",placeItems:"center",marginTop:14}}>Sign out</a></main></AppShell>
}
