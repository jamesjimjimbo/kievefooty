import type {Metadata} from "next";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {ArrowLeft,CheckCircle2,Clock3,MessageCircle,Trash2,Trophy,XCircle} from "lucide-react";
import {AppShell} from "@/components/app-shell";
import {ClubCrest} from "@/components/club-crest";
import {createClient} from "@/lib/supabase/server";
import {addPlayerWallPost,deletePlayerWallPost} from "./actions";

export const metadata:Metadata={title:"Player"};export const dynamic="force-dynamic";
type Standing={user_id:string;score:number|string};
type Pick={
  id:string;kind:"gotw"|"own";selected_outcome:"home"|"draw"|"away";stake:number|string;odds:number|string;is_correct:boolean|null;
  fixture:{status:string;home_score:number|null;away_score:number|null;home:{name:string}|null;away:{name:string}|null}|null;
};
type Submission={
  id:string;commentary:string|null;submitted_at:string;
  week:{number:number;label:string;status:string;lock_at:string}|null;
  picks:Pick[];
};
type WallPost={id:string;author_user_id:string;body:string;created_at:string;author:{display_name:string;crest_url:string|null}|null};

const points=(value:number)=>Number.isInteger(value)?String(value):value.toFixed(2).replace(/0+$/,"").replace(/\.$/,"");
const selectionLabel=(pick:Pick)=>pick.selected_outcome==="draw"?"Draw":pick.selected_outcome==="home"?(pick.fixture?.home?.name??"Home"):(pick.fixture?.away?.name??"Away");
const pickReturn=(pick:Pick)=>pick.is_correct===true?Number(pick.stake)*Number(pick.odds):pick.is_correct===false?0:null;

export default async function PlayerPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{wall?:string}>}){
  const {id}=await params;const query=await searchParams;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))notFound();
  const supabase=await createClient();if(!supabase)redirect("/auth/sign-in");const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
  const [{data:profile},{data:overall},{data:first},{data:second},{data:submissions},{data:wallData},{data:viewer}]=await Promise.all([
    supabase.from("profiles").select("id,display_name,favorite_team,bio,motto,crest_url").eq("id",id).maybeSingle(),
    supabase.rpc("get_standings",{p_half:null}),supabase.rpc("get_standings",{p_half:"first"}),supabase.rpc("get_standings",{p_half:"second"}),
    supabase.from("weekly_submissions").select("id,commentary,submitted_at,week:competition_weeks(number,label,status,lock_at),picks(id,kind,selected_outcome,stake,odds,is_correct,fixture:fixtures(status,home_score,away_score,home:teams!fixtures_home_team_id_fkey(name),away:teams!fixtures_away_team_id_fkey(name)))").eq("user_id",id).order("submitted_at",{ascending:false}),
    supabase.from("player_wall_posts").select("id,author_user_id,body,created_at,author:profiles!player_wall_posts_author_user_id_fkey(display_name,crest_url)").eq("target_user_id",id).order("created_at",{ascending:false}),
    supabase.from("profiles").select("is_admin").eq("id",user.id).single(),
  ]);if(!profile)notFound();
  const overallRows=(overall??[]) as Standing[];const foundRank=overallRows.findIndex(row=>row.user_id===id);const rank=foundRank<0?overallRows.length+1:foundRank+1;
  const score=(rows:Standing[],userId:string)=>Number(rows.find(row=>row.user_id===userId)?.score??0);
  const weekly=((submissions??[]) as unknown as Submission[]).sort((a,b)=>(b.week?.number??0)-(a.week?.number??0));
  const resolvedPicks=weekly.flatMap(submission=>submission.picks??[]).filter(pick=>pick.is_correct!==null);const correct=resolvedPicks.filter(pick=>pick.is_correct).length;const accuracy=resolvedPicks.length?`${((correct/resolvedPicks.length)*100).toFixed(1)}%`:"—";
  const weeklyReturns=weekly.flatMap(submission=>submission.picks??[]).reduce((sum,pick)=>sum+(pickReturn(pick)??0),0);const fullScore=score(overallRows,id);const adjustments=fullScore-weeklyReturns;
  const posts=(wallData??[]) as unknown as WallPost[];const canModerate=Boolean(viewer?.is_admin)||user.id===id;
  return <AppShell><main className="content player-page">
    <Link className="player-back" href="/clubhouse"><ArrowLeft size={16}/>Back to the Clubhouse</Link>
    <section className="card player-page-hero"><div className="player-page-crest"><ClubCrest seed={profile.id} label={profile.display_name} imageUrl={profile.crest_url} size="xl"/></div><div className="player-page-intro"><p className="eyebrow">League member · #{rank}</p><h1>{profile.display_name}</h1><p className="player-page-team">{profile.favorite_team||"Undeclared allegiance"}</p>{profile.motto&&<blockquote>“{profile.motto}”</blockquote>}<p className="player-page-bio">{profile.bio||"Scouting report pending."}</p>{user.id===id&&<Link className="secondary player-edit-link" href="/profile">Edit my player card</Link>}</div></section>
    <section className="player-page-stats" aria-label={`${profile.display_name} league statistics`}><div className="card"><span>Overall rank</span><b>#{rank}</b></div><div className="card"><span>Full score</span><b>{points(fullScore)}</b></div><div className="card"><span>First / Second</span><b>{points(score((first??[]) as Standing[],id))} / {points(score((second??[]) as Standing[],id))}</b></div><div className="card"><span>Pick accuracy</span><b>{accuracy}</b><small>{correct} of {resolvedPicks.length}</small></div></section>
    <section className="player-picks-section">
      <div className="section-label player-picks-heading"><div><p className="eyebrow">Picks &amp; points</p><h2>How {profile.display_name} got here</h2><p className="subtle">Every revealed pick, its locked price, and the points it returned.</p></div><Trophy size={22}/></div>
      <div className="card player-score-explainer"><div><span>Match returns</span><b>{points(weeklyReturns)}</b></div><span className="score-operator">+</span><div><span>Other adjustments</span><b>{points(adjustments)}</b></div><span className="score-operator">=</span><div className="score-total"><span>Full score</span><b>{points(fullScore)}</b></div><p>Other adjustments include season competitions, challenges, and streak bonuses.</p></div>
      <div className="player-week-list">{weekly.length?weekly.map(submission=>{
        const weekReturn=(submission.picks??[]).reduce((sum,pick)=>sum+(pickReturn(pick)??0),0);const pending=(submission.picks??[]).some(pick=>pick.is_correct===null);
        return <article className="card player-week-card" key={submission.id}><header><div><span className="week-kicker">Week {submission.week?.number??"—"}</span><h3>{submission.week?.label??"Competition week"}</h3></div><div className={`week-return ${pending?"live":"final"}`}><small>{pending?"Return so far":"Final return"}</small><b>{points(weekReturn)} pts</b></div></header>
          <div className="player-pick-list">{(submission.picks??[]).map(pick=>{const returned=pickReturn(pick);return <div className="player-pick-row" key={pick.id}><div className={`pick-result-icon ${pick.is_correct===true?"won":pick.is_correct===false?"lost":"pending"}`}>{pick.is_correct===true?<CheckCircle2 size={18}/>:pick.is_correct===false?<XCircle size={18}/>:<Clock3 size={18}/>}</div><div className="pick-summary"><span>{pick.kind==="gotw"?"Game of the Week":"Own choice"}</span><b>{selectionLabel(pick)}</b><small>{pick.fixture?.home?.name??"Home"} vs {pick.fixture?.away?.name??"Away"}</small></div><div className="pick-math"><span>{points(Number(pick.stake))} pts × {Number(pick.odds).toFixed(2)}</span><b>{returned===null?"Pending":`${points(returned)} pts`}</b></div></div>})}</div>
          {submission.commentary&&<blockquote className="player-week-comment">“{submission.commentary}”</blockquote>}
        </article>;
      }):<div className="card player-picks-empty"><Clock3 size={20}/><div><b>No revealed picks yet.</b><p>{user.id===id?"Your submitted picks will appear here.":"This player’s picks become visible when the market locks."}</p></div></div>}</div>
    </section>
    <section className="player-wall-section"><div className="section-label"><div><p className="eyebrow">Open season</p><h2>{profile.display_name}&apos;s wall</h2><p className="subtle">Leave praise, analysis, or completely unnecessary provocation.</p></div><MessageCircle size={22}/></div>
      {query.wall==="posted"&&<div className="notice success">Message posted.</div>}{query.wall==="invalid"&&<div className="notice error">Keep it between 1 and 180 characters.</div>}{query.wall==="error"&&<div className="notice error">That message could not be saved. Please try again.</div>}
      <form action={addPlayerWallPost} className="card player-wall-compose"><input type="hidden" name="target_user_id" value={id}/><textarea name="body" maxLength={180} rows={3} required placeholder={`Say something to ${profile.display_name}…`}/><div><span>180 characters max</span><button className="primary">Post to wall</button></div></form>
      <div className="player-wall-list">{posts.length?posts.map(post=>{const author=post.author?.display_name??"Player";const canDelete=canModerate||post.author_user_id===user.id;return <article className="card player-wall-post" key={post.id}><Link href={`/players/${post.author_user_id}`}><ClubCrest seed={post.author_user_id} label={author} imageUrl={post.author?.crest_url} size="md"/></Link><div><header><div><Link className="player-name-link" href={`/players/${post.author_user_id}`}>{author}</Link><time>{new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(post.created_at))}</time></div>{canDelete&&<form action={deletePlayerWallPost}><input type="hidden" name="target_user_id" value={id}/><input type="hidden" name="post_id" value={post.id}/><button aria-label="Delete wall post"><Trash2 size={14}/></button></form>}</header><p>{post.body}</p></div></article>}):<div className="card player-wall-empty"><Trophy size={20}/><div><b>A suspiciously clean wall.</b><p>Be the first to leave a mark.</p></div></div>}</div>
    </section>
  </main></AppShell>;
}
