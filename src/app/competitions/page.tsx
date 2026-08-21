import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {ArrowDown,Sparkles} from "lucide-react";
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
type EntryRow={market_id:string;user_id:string;option_ids:string[];profiles:{display_name:string;crest_url:string|null}|null};
type ProfileRow={id:string;display_name:string;crest_url:string|null};
type RevealedMarket={
  id:string;slug:string;title:string;options:string[];
  entries:{userId:string;name:string;crestUrl:string|null;selections:string[]}[];
};

export default async function CompetitionsPage(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  const [{data:marketData,error},{data:entryData},{data:profileData}]=await Promise.all([
    supabase.from("season_markets").select("id,slug,title,description,selection_help,min_selections,max_selections,payout_label,lock_at,status,season_market_options(id,label,sort_order,odds)").order("display_order"),
    supabase.from("season_market_entries").select("market_id,user_id,option_ids,profiles(display_name,crest_url)"),
    supabase.from("profiles").select("id,display_name,crest_url").order("display_name"),
  ]);
  if(error)return <AppShell><main className="content"><div className="page-head"><div><p className="eyebrow">Season-long</p><h1>Competitions</h1></div></div><div className="notice">Season competitions are ready in the app, but the database update still needs to be applied.</div></main></AppShell>;
  const allEntries=(entryData??[]) as unknown as EntryRow[];
  const entries=new Map(allEntries.filter(entry=>entry.user_id===user.id).map(entry=>[entry.market_id,entry.option_ids]));
  const now=Date.now();
  const markets=((marketData??[]) as unknown as MarketRow[]).map(row=>({
    id:row.id,slug:row.slug,title:row.title,description:row.description,
    selectionHelp:row.selection_help,minSelections:row.min_selections,maxSelections:row.max_selections,
    payoutLabel:row.payout_label,
    lockLabel:new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(row.lock_at)),
    status:row.status==="open"&&new Date(row.lock_at).getTime()<=now?"locked":row.status,
    selected:entries.get(row.id)??[],completed:entries.has(row.id),
    options:[...(row.season_market_options??[])].sort((a,b)=>a.sort_order-b.sort_order).map(option=>({...option,odds:option.odds===null?null:Number(option.odds)})),
  })) satisfies SeasonMarket[];
  const open=markets.filter(market=>market.status==="open");
  const entryMarkets=markets.filter(market=>market.status==="open"||market.status==="draft");
  const revealed=((marketData??[]) as unknown as MarketRow[])
    .filter(market=>market.status==="locked"||market.status==="settled"||(market.status==="open"&&new Date(market.lock_at).getTime()<=now))
    .map(market=>{
      const labels=new Map((market.season_market_options??[]).map(option=>[option.id,option.label]));
      return {
        id:market.id,slug:market.slug,title:market.title,
        options:(market.season_market_options??[]).map(option=>option.label),
        entries:allEntries.filter(entry=>entry.market_id===market.id).map(entry=>({
          userId:entry.user_id,name:entry.profiles?.display_name??"Player",crestUrl:entry.profiles?.crest_url??null,
          selections:entry.option_ids.map(id=>labels.get(id)??"Selection"),
        })).sort((a,b)=>a.name.localeCompare(b.name)),
      };
    });
  return <AppShell><main className="content content-wide competitions-page">
    <div className="page-head"><div><p className="eyebrow">The long game</p><h1>Season competitions</h1><p className="subtle">{open.length?"Make the big calls now.":"The league has made its calls. Track every prediction below."}</p></div>{open.length>0&&<span className="pill live"><Sparkles size={13}/>{open.length} open</span>}</div>
    {revealed.length>0&&<PredictionWall markets={revealed} profiles={(profileData??[]) as ProfileRow[]}/>}
    {entryMarkets.length>0&&<>
      <div className="section-label competition-picks-heading"><div><p className="eyebrow">{open.length?"Your entry card":"Coming later"}</p><h2>{open.length?"Make your picks":"Future competitions"}</h2><p className="subtle">{open.length?"Open competitions can be saved or updated until their deadline.":"These markets will open closer to the action."}</p></div><ArrowDown size={19}/></div>
      <div className="market-grid">{entryMarkets.map(market=><SeasonMarketCard key={market.id} market={market}/>)}</div>
    </>}
  </main></AppShell>;
}

const TEAM_MARKERS:Record<string,{symbol:string;label:string;className:string}>={
  champion:{symbol:"W",label:"Winner",className:"winner"},
  "top-four":{symbol:"T4",label:"Top four",className:"top-four"},
  "fifth-to-seventh":{symbol:"T7",label:"Fifth–seventh",className:"top-seven"},
  relegation:{symbol:"R",label:"Relegated",className:"relegated"},
  "manager-exit":{symbol:"S",label:"Manager sacked",className:"sacked"},
};

function PredictionWall({markets,profiles}:{markets:RevealedMarket[];profiles:ProfileRow[]}){
  const teamMarkets=markets.filter(market=>TEAM_MARKERS[market.slug]);
  const goldenBoot=markets.find(market=>market.slug==="golden-boot");
  const entrants=profiles.length?profiles:uniqueEntrants(markets);
  const teams=[...new Set(teamMarkets.flatMap(market=>market.options))].sort((a,b)=>a.localeCompare(b));
  const goldenBootPlayers=[...new Set(goldenBoot?.entries.flatMap(entry=>entry.selections)??[])].sort((a,b)=>a.localeCompare(b));
  const teamPicks=new Map<string,{symbol:string;label:string;className:string}[]>();
  for(const market of teamMarkets){
    const marker=TEAM_MARKERS[market.slug];
    for(const entry of market.entries){
      for(const team of entry.selections){
        const key=`${entry.userId}:${team}`;
        teamPicks.set(key,[...(teamPicks.get(key)??[]),marker]);
      }
    }
  }
  const goldenBootPicks=new Set(goldenBoot?.entries.flatMap(entry=>entry.selections.map(player=>`${entry.userId}:${player}`))??[]);
  return <section className="prediction-wall">
    <div className="section-label"><div><p className="eyebrow">Cards on the table</p><h2>League prediction grid</h2><p className="prediction-wall-intro">Every club call in one view. Scroll sideways to see the whole league.</p></div></div>
    <div className="prediction-legend">{Object.values(TEAM_MARKERS).map(marker=><span key={marker.symbol}><i className={marker.className}>{marker.symbol}</i>{marker.label}</span>)}</div>
    <PredictionMatrix title="Premier League predictions" rowLabel="Club" rows={teams} entrants={entrants} renderCell={(team,entrant)=><MarkerStack markers={teamPicks.get(`${entrant.id}:${team}`)??[]}/>}/>
    {goldenBoot&&<div className="golden-boot-grid">
      <div className="section-label"><div><p className="eyebrow">Golden Boot</p><h2>Top-scorer picks</h2><p className="prediction-wall-intro">Only selected players are shown.</p></div></div>
      <PredictionMatrix title="Golden Boot predictions" rowLabel="Player" rows={goldenBootPlayers} entrants={entrants} renderCell={(player,entrant)=>goldenBootPicks.has(`${entrant.id}:${player}`)?<span className="golden-boot-pick" title="Golden Boot pick">⚽</span>:null}/>
    </div>}
  </section>;
}

function uniqueEntrants(markets:RevealedMarket[]):ProfileRow[]{
  const people=new Map<string,ProfileRow>();
  for(const entry of markets.flatMap(market=>market.entries))people.set(entry.userId,{id:entry.userId,display_name:entry.name,crest_url:entry.crestUrl});
  return [...people.values()].sort((a,b)=>a.display_name.localeCompare(b.display_name));
}

function MarkerStack({markers}:{markers:{symbol:string;label:string;className:string}[]}){
  if(!markers.length)return null;
  return <span className="prediction-marker-stack">{markers.map(marker=><i className={marker.className} title={marker.label} aria-label={marker.label} key={marker.symbol}>{marker.symbol}</i>)}</span>;
}

function PredictionMatrix({title,rowLabel,rows,entrants,renderCell}:{
  title:string;rowLabel:string;rows:string[];entrants:ProfileRow[];
  renderCell:(row:string,entrant:ProfileRow)=>React.ReactNode;
}){
  return <div className="card prediction-matrix-card">
    <div className="prediction-matrix-scroll">
      <table className="prediction-matrix" aria-label={title}>
        <thead><tr><th scope="col">{rowLabel}</th>{entrants.map(entrant=><th scope="col" key={entrant.id}><Link href={`/players/${entrant.id}`}><ClubCrest seed={entrant.id} label={entrant.display_name} imageUrl={entrant.crest_url} size="sm"/><span>{entrant.display_name}</span></Link></th>)}</tr></thead>
        <tbody>{rows.length?rows.map(row=><tr key={row}><th scope="row">{row}</th>{entrants.map(entrant=><td key={entrant.id}>{renderCell(row,entrant)}</td>)}</tr>):<tr><td className="prediction-empty" colSpan={entrants.length+1}>No picks were submitted.</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}
