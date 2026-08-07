import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClubCrest } from "@/components/club-crest";
import { PlayerProfileEditor } from "@/components/player-profile-editor";
import { createClient } from "@/lib/supabase/server";
import { updatePreferences } from "./actions";

export const metadata:Metadata={title:"Profile"};export const dynamic="force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}){
 const query=await searchParams;const supabase=await createClient();if(!supabase)redirect("/auth/sign-in");const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
 const [{data:profile},{data:prefs},{data:ledger},{count:opponents},{count:used},{data:teams}]=await Promise.all([
  supabase.from("profiles").select("display_name,email,is_admin,favorite_team,bio,motto,crest_url,crest_source,profile_completed_at").eq("id",user.id).single(),
  supabase.from("email_preferences").select("*").eq("user_id",user.id).maybeSingle(),
  supabase.from("points_ledger").select("amount").eq("user_id",user.id),
  supabase.from("profiles").select("*",{count:"exact",head:true}).neq("id",user.id),
  supabase.from("challenges").select("*",{count:"exact",head:true}).eq("challenger_id",user.id),
  supabase.from("teams").select("name").order("name"),
 ]);
 const name=profile?.display_name??user.email?.split("@")[0]??"Player";const balance=(ledger??[]).reduce((s,row)=>s+Number(row.amount),0);
 const settings=[["new_week","New week opens",prefs?.new_week??true],["deadline_reminder","Deadline reminders",prefs?.deadline_reminder??true],["challenge_notification","Challenge notifications",prefs?.challenge_notification??true],["weekly_results","Weekly results",prefs?.weekly_results??false]] as const;
 return <AppShell><main className="content"><div className="page-head"><div><p className="eyebrow">Your clubhouse</p><h1>Player card</h1></div></div>
 {query.saved&&<div className="notice success">Player card saved.</div>}{query.error&&<div className="notice error">{query.error}</div>}
 <section className="card profile-identity"><ClubCrest seed={user.id} label={name} imageUrl={profile?.crest_url} size="lg"/><div><p className="eyebrow">Your club</p><h2>{name}</h2><p className="subtle">{profile?.favorite_team||"No allegiance declared"}{profile?.is_admin?" · Admin":""}</p>{profile?.motto&&<blockquote>“{profile.motto}”</blockquote>}</div><span className="pill">{profile?.crest_source?"Crest ready":"Crest to come"}</span></section>
 <PlayerProfileEditor userId={user.id} displayName={name} favoriteTeam={profile?.favorite_team??""} bio={profile?.bio??""} motto={profile?.motto??""} crestUrl={profile?.crest_url??null} teams={(teams??[]).map(team=>team.name)}/>
 <div className="grid-2 profile-stats"><section className="card"><p className="eyebrow">Bankroll</p><h1>{balance}</h1><p className="subtle">Available points</p></section><section className="card"><p className="eyebrow">Challenge tokens</p><h1>{Math.max(0,(opponents??0)-(used??0))}</h1><p className="subtle">Opponents remaining</p></section></div>
 <form action={updatePreferences} className="card profile-settings"><h2>Emails</h2>{settings.map(([key,label,checked])=><label className="setting" key={key}><span><b>{label}</b><small className="subtle">Keep me in the loop</small></span><input name={key} type="checkbox" defaultChecked={checked}/></label>)}<button className="secondary">Save preferences</button></form>
 <a href="/auth/sign-out" className="secondary profile-signout">Sign out</a></main></AppShell>;
}
