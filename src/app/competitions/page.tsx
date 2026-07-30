import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {Sparkles,Trophy} from "lucide-react";
import {AppShell} from "@/components/app-shell";
import {ClubCrest} from "@/components/club-crest";
import {SeasonMarketCard,type SeasonMarket} from "@/components/season-market-card";
import {createClient} from "@/lib/supabase/server";

export const metadata:Metadata={title:"Season competitions"};
export const dynamic="force-dynamic";

type MarketRow={
  id:string;slug:string;title:string;description:string;selection_help:string;
  min_selections:number;max_selections:number;payout_label:string;lock_at:string;status:string;
  season_market_options:{id:string;label:string;sort_order:number;odds:number|string|null}[];
};
type EntryRow={market_id:string;user_id:string;option_ids:string[];profiles:{display_name:string}|null};

export default async function CompetitionsPage(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  const [{data:marketData,error},{data:entryData}]=await Promise.all([
    supabase.from("season_markets").select("id,slug,title,description,selection_help,min_selections,max_selections,payout_label,lock_at,status,season_market_options(id,label,sort_order,odds)").order("display_order"),
    supabase.from("season_market_entries").select("market_id,user_id,option_ids,profiles(display_name)"),
  ]);
  if(error)return <AppShell><main className="content"><div className="page-head"><div><p className="eyebrow">Season-long</p><h1>Competitions</h1></div></div><div className="notice">Season competitions are ready in the app, but the database update still needs to be applied.</div></main></AppShell>;
  const allEntries=(entryData??[]) as unknown as EntryRow[];
  const entries=new Map(allEntries.filter(entry=>entry.user_id===user.id).map(entry=>[entry.market_id,entry.option_ids]));
  const markets=((marketData??[]) as unknown as MarketRow[]).map(row=>({
    id:row.id,slug:row.slug,title:row.title,description:row.description,
    selectionHelp:row.selection_help,minSelections:row.min_selections,maxSelections:row.max_selections,
    payoutLabel:row.payout_label,
    lockLabel:new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(row.lock_at)),
    status:row.status,selected:entries.get(row.id)??[],
    options:[...(row.season_market_options??[])].sort((a,b)=>a.sort_order-b.sort_order).map(option=>({...option,odds:option.odds===null?null:Number(option.odds)})),
  })) satisfies SeasonMarket[];
  const open=markets.filter(market=>market.status==="open");
  const later=markets.filter(market=>market.status!=="open");
  const revealed=((marketData??[]) as unknown as MarketRow[])
    .filter(market=>market.status==="locked"||market.status==="settled")
    .map(market=>{
      const labels=new Map((market.season_market_options??[]).map(option=>[option.id,option.label]));
      return {
        id:market.id,title:market.title,
        entries:allEntries.filter(entry=>entry.market_id===market.id).map(entry=>({
          userId:entry.user_id,name:entry.profiles?.display_name??"Player",
          selections:entry.option_ids.map(id=>labels.get(id)??"Selection"),
        })).sort((a,b)=>a.name.localeCompare(b.name)),
      };
    });
  return <AppShell><main className="content content-wide competitions-page">
    <div className="page-head"><div><p className="eyebrow">The long game</p><h1>Season competitions</h1><p className="subtle">Make the big calls now. Position projections follow the latest saved Premier League table.</p></div><span className="pill live"><Sparkles size={13}/>{open.length} open</span></div>
    <section className="card competitions-explainer"><span className="icon-box"><Trophy size={20}/></span><div><b>How projections work</b><p>The Full Competition table shows official points beside the score you would have if today&apos;s results became final. Projections never change your official score.</p></div></section>
    <div className="market-grid">{open.map(market=><SeasonMarketCard key={market.id} market={market}/>)}</div>
    {later.length>0&&<><div className="section-label"><div><p className="eyebrow">On the schedule</p><h2>Opening later</h2></div></div><div className="market-grid market-grid-later">{later.map(market=><SeasonMarketCard key={market.id} market={market}/>)}</div></>}
    {revealed.length>0&&<PredictionWall markets={revealed}/>}
  </main></AppShell>;
}

function PredictionWall({markets}:{markets:{id:string;title:string;entries:{userId:string;name:string;selections:string[]}[]}[]}){
  return <section className="prediction-wall">
    <div className="section-label"><div><p className="eyebrow">Cards on the table</p><h2>Prediction Wall</h2><p className="prediction-wall-intro">Locked picks are public. See where the league agrees—and who has gone rogue.</p></div></div>
    <div className="prediction-market-grid">{markets.map(market=><article className="card prediction-market" key={market.id}>
      <header><span>{market.entries.length} entr{market.entries.length===1?"y":"ies"}</span><h3>{market.title}</h3></header>
      <div className="prediction-entry-list">{market.entries.length?market.entries.map(entry=><div className="prediction-entry" key={entry.userId}>
        <ClubCrest seed={entry.userId} label={entry.name} size="sm"/>
        <div><b>{entry.name}</b><span>{entry.selections.map(selection=><i key={selection}>{selection}</i>)}</span></div>
      </div>):<p className="subtle">No entries were submitted.</p>}</div>
    </article>)}</div>
  </section>;
}
