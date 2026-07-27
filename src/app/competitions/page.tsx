import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {Sparkles,Trophy} from "lucide-react";
import {AppShell} from "@/components/app-shell";
import {SeasonMarketCard,type SeasonMarket} from "@/components/season-market-card";
import {createClient} from "@/lib/supabase/server";

export const metadata:Metadata={title:"Season competitions"};
export const dynamic="force-dynamic";

type MarketRow={
  id:string;slug:string;title:string;description:string;selection_help:string;
  max_selections:number;points_per_correct:number|string;lock_at:string;status:string;
  current_option_ids:string[];
  season_market_options:{id:string;label:string;sort_order:number}[];
};
type EntryRow={market_id:string;option_ids:string[]};

export default async function CompetitionsPage(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  const [{data:marketData,error},{data:entryData}]=await Promise.all([
    supabase.from("season_markets").select("id,slug,title,description,selection_help,max_selections,points_per_correct,lock_at,status,current_option_ids,season_market_options(id,label,sort_order)").order("display_order"),
    supabase.from("season_market_entries").select("market_id,option_ids").eq("user_id",user.id),
  ]);
  if(error)return <AppShell><main className="content"><div className="page-head"><div><p className="eyebrow">Season-long</p><h1>Competitions</h1></div></div><div className="notice">Season competitions are ready in the app, but the database update still needs to be applied.</div></main></AppShell>;
  const entries=new Map(((entryData??[]) as EntryRow[]).map(entry=>[entry.market_id,entry.option_ids]));
  const markets=((marketData??[]) as unknown as MarketRow[]).map(row=>({
    id:row.id,slug:row.slug,title:row.title,description:row.description,
    selectionHelp:row.selection_help,maxSelections:row.max_selections,
    pointsPerCorrect:Number(row.points_per_correct),
    lockLabel:new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(row.lock_at)),
    status:row.status,selected:entries.get(row.id)??[],
    options:[...(row.season_market_options??[])].sort((a,b)=>a.sort_order-b.sort_order).map(option=>({...option,current:(row.current_option_ids??[]).includes(option.id)})),
  })) satisfies SeasonMarket[];
  const open=markets.filter(market=>market.status==="open");
  const later=markets.filter(market=>market.status!=="open");
  return <AppShell><main className="content content-wide competitions-page">
    <div className="page-head"><div><p className="eyebrow">The long game</p><h1>Season competitions</h1><p className="subtle">Make the big calls now. Projected points update as the real table changes.</p></div><span className="pill live"><Sparkles size={13}/>{open.length} open</span></div>
    <section className="card competitions-explainer"><span className="icon-box"><Trophy size={20}/></span><div><b>How projections work</b><p>Open the Full standings and turn on season bets to see the table as if today&apos;s results were final. Projections never change your official score.</p></div></section>
    <div className="market-grid">{open.map(market=><SeasonMarketCard key={market.id} market={market}/>)}</div>
    {later.length>0&&<><div className="section-label"><div><p className="eyebrow">On the schedule</p><h2>Opening later</h2></div></div><div className="market-grid market-grid-later">{later.map(market=><SeasonMarketCard key={market.id} market={market}/>)}</div></>}
  </main></AppShell>;
}
