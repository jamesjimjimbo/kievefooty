import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, MessagesSquare, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ClubCrest } from "@/components/club-crest";
import { WeeklyConversations } from "@/components/weekly-conversations";
import { createClient } from "@/lib/supabase/server";
import type { WeeklyConversation,WeeklyReaction } from "@/lib/weekly-conversations";

export const metadata:Metadata={title:"Clubhouse"};export const dynamic="force-dynamic";
type Profile={id:string;display_name:string;favorite_team:string|null;bio:string|null;motto:string|null;crest_url:string|null;profile_completed_at:string|null};
type Standing={user_id:string;score:number|string};
type Submission={id:string;user_id:string;commentary:string|null;profiles:{display_name:string;crest_url:string|null}|null};
type Reaction={submission_id:string;user_id:string;reaction:WeeklyReaction};
type Reply={id:string;submission_id:string;user_id:string;body:string;created_at:string;profiles:{display_name:string;crest_url:string|null}|null};
function hasLocked(lockAt:string){return new Date().getTime()>=Date.parse(lockAt)}

export default async function ClubhousePage(){
  const supabase=await createClient();if(!supabase)redirect("/auth/sign-in");const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
  const [{data:profiles},{data:standings},{data:openWeek}]=await Promise.all([
    supabase.from("profiles").select("id,display_name,favorite_team,bio,motto,crest_url,profile_completed_at").order("display_name"),
    supabase.rpc("get_standings",{p_half:null}),
    supabase.from("competition_weeks").select("id,label,lock_at").eq("is_active_betting_week",true).eq("status","open").order("start_date").limit(1).maybeSingle(),
  ]);
  const {data:lockedWeek}=openWeek?{data:null}:await supabase.from("competition_weeks").select("id,label,lock_at").eq("is_active_betting_week",true).eq("status","locked").order("start_date",{ascending:false}).limit(1).maybeSingle();
  const week=openWeek??lockedWeek;
  const locked=Boolean(week?.lock_at&&hasLocked(week.lock_at));
  let conversations:WeeklyConversation[]=[];
  if(week&&locked){
    const {data:submissionData}=await supabase.from("weekly_submissions").select("id,user_id,commentary,profiles(display_name,crest_url)").eq("competition_week_id",week.id).not("commentary","is",null).order("submitted_at");
    const submissions=(submissionData??[]) as unknown as Submission[];const ids=submissions.map(row=>row.id);
    if(ids.length){
      const [{data:reactionData},{data:replyData}]=await Promise.all([
        supabase.from("weekly_comment_reactions").select("submission_id,user_id,reaction").in("submission_id",ids),
        supabase.from("weekly_comment_replies").select("id,submission_id,user_id,body,created_at,profiles(display_name,crest_url)").in("submission_id",ids).order("created_at"),
      ]);
      const reactions=(reactionData??[]) as Reaction[];const replies=(replyData??[]) as unknown as Reply[];
      conversations=submissions.map(row=>({submissionId:row.id,userId:row.user_id,name:row.profiles?.display_name??"Player",crestUrl:row.profiles?.crest_url??null,commentary:row.commentary??"",reactions:reactions.filter(item=>item.submission_id===row.id).map(item=>({userId:item.user_id,reaction:item.reaction})),replies:replies.filter(item=>item.submission_id===row.id).map(item=>({id:item.id,userId:item.user_id,name:item.profiles?.display_name??"Player",crestUrl:item.profiles?.crest_url??null,body:item.body,createdAt:item.created_at}))}));
    }
  }
  const scoreMap=new Map(((standings??[]) as Standing[]).map(row=>[row.user_id,Number(row.score)]));
  const playerRows=(profiles??[]) as Profile[];const me=playerRows.find(profile=>profile.id===user.id);const incomplete=!me?.profile_completed_at;
  return <AppShell><main className="content content-wide clubhouse-page">
    <div className="page-head clubhouse-head"><div><p className="eyebrow">The people behind the picks</p><h1>Clubhouse</h1><p className="subtle">Badges, allegiances, questionable expertise, and the weekly press room.</p></div><div className="clubhouse-count"><UsersRound/><b>{playerRows.length}</b><span>players</span></div></div>
    {incomplete&&<section className="card profile-nudge"><ClubCrest seed={user.id} label={me?.display_name??"You"} imageUrl={me?.crest_url} size="md"/><div><b>Finish your player card</b><p>Add your crest, favorite club, and bio before the league arrives.</p></div><Link className="secondary" href="/profile">Build my card</Link></section>}
    <section className="clubhouse-section"><div className="section-label"><div><p className="eyebrow">Squad list</p><h2>Meet the league</h2></div></div><div className="player-card-grid">{playerRows.sort((a,b)=>(scoreMap.get(b.id)??0)-(scoreMap.get(a.id)??0)).map((profile,index)=><Link className="card player-card player-card-link" href={`/players/${profile.id}`} key={profile.id}><div className="player-card-top"><ClubCrest seed={profile.id} label={profile.display_name} imageUrl={profile.crest_url} size="lg"/><span className="player-rank">#{index+1}</span></div><div><h3>{profile.display_name}</h3><p className="favorite-club">{profile.favorite_team||"Undeclared allegiance"}</p></div>{profile.motto&&<blockquote>“{profile.motto}”</blockquote>}<p className="player-bio">{profile.bio||"Scouting report pending."}</p><div className="player-card-score"><span>Overall</span><b>{scoreMap.get(profile.id)??0} pts</b></div></Link>)}</div></section>
    <section className="clubhouse-section press-room"><div className="section-label"><div><p className="eyebrow">This week</p><h2>Press room</h2><p className="subtle">Comments are written with picks, then revealed to everyone at the deadline.</p></div>{week&&<span className={`pill ${locked?"live":""}`}>{week.label}</span>}</div>
      {!week?<div className="card empty-press-room"><MessagesSquare/><div><b>No active press room</b><p className="subtle">It opens with the next competition week.</p></div></div>:!locked?<div className="card press-room-locked"><LockKeyhole/><div><b>Statements under embargo</b><p className="subtle">Everyone&apos;s comments stay private until {new Intl.DateTimeFormat("en-US",{weekday:"long",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(week.lock_at))}.</p></div></div>:<WeeklyConversations threads={conversations} currentUserId={user.id}/>} 
    </section>
  </main></AppShell>;
}
