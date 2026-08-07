"use client";

import { useState,useTransition } from "react";
import { Check,Clock3,LockKeyhole,Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveSeasonEntry } from "@/app/competitions/actions";

export type SeasonMarket={
  id:string;slug:string;title:string;description:string;selectionHelp:string;
  minSelections:number;maxSelections:number;payoutLabel:string;lockLabel:string;status:string;
  options:{id:string;label:string;odds:number|null}[];selected:string[];completed:boolean;
};

export function SeasonMarketCard({market}:{market:SeasonMarket}){
  const router=useRouter();
  const [selected,setSelected]=useState(market.selected);
  const [query,setQuery]=useState("");
  const [message,setMessage]=useState("");
  const [pending,startTransition]=useTransition();
  const open=market.status==="open";
  const showSearch=market.options.length>20;
  const normalizedQuery=query.trim().toLocaleLowerCase();
  const visibleOptions=normalizedQuery
    ?market.options.filter(option=>option.label.toLocaleLowerCase().includes(normalizedQuery)||selected.includes(option.id))
    :market.options;
  const toggle=(id:string)=>{
    if(!open)return;
    setMessage("");
    setSelected(current=>{
      if(current.includes(id))return current.filter(value=>value!==id);
      if(current.length>=market.maxSelections)return current;
      return [...current,id];
    });
  };
  const save=()=>startTransition(async()=>{
    const result=await saveSeasonEntry({marketId:market.id,optionIds:selected});
    if("error" in result){setMessage(result.error??"Unable to save");return}
    setMessage("Prediction saved");
    router.refresh();
  });
  return <article id={`market-${market.slug}`} className={`card market-card ${open?"":"market-closed"}`}>
    <header className="market-head"><div><div className="market-kicker"><span>{market.minSelections===0?"Optional":market.maxSelections===1?"Single pick":`${market.maxSelections} picks`}</span><i/> <span>{market.payoutLabel}</span></div><h2>{market.title}</h2><p className="subtle">{market.description}</p></div><span className={`market-status ${open?"open":""}`}>{open?<Clock3 size={13}/>:<LockKeyhole size={13}/>} {open?"Open":market.status==="draft"?"Opens later":"Locked"}</span></header>
    {market.options.length?<><div className="market-selection-head"><b>{market.selectionHelp}</b><span>{selected.length}{market.minSelections===market.maxSelections?`/${market.maxSelections}`:`/${market.maxSelections} max`}</span></div>
    {showSearch&&<label className="market-search"><Search size={15}/><span className="sr-only">Search {market.title} options</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search players"/></label>}
    <div className="market-options">{visibleOptions.map(option=><button type="button" key={option.id} disabled={!open} onClick={()=>toggle(option.id)} className={`market-option ${selected.includes(option.id)?"selected":""}`}><span>{option.label}{option.odds?` · ${option.odds.toFixed(2)}`:""}</span>{selected.includes(option.id)&&<Check size={14}/>}</button>)}</div>
    <footer className="market-footer"><div><small>Locks {market.lockLabel}</small><strong>{market.payoutLabel}</strong></div><button className="primary market-save" disabled={!open||pending||selected.length<market.minSelections||selected.length>market.maxSelections} onClick={save}>{pending?"Saving…":market.selected.length?"Update pick":market.minSelections===0&&selected.length===0?"Skip market":"Save pick"}</button></footer></>:<div className="market-coming"><LockKeyhole size={18}/><div><b>{market.selectionHelp}</b><p>{market.payoutLabel}. Entries open when the option list is confirmed.</p></div></div>}
    {message&&<div className={message.toLowerCase().includes("error")?"notice":"saved"}>{message}</div>}
  </article>;
}
