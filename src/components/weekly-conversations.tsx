"use client";
import { FormEvent, useState, useTransition } from "react";
import { MessageCircle, Send } from "lucide-react";
import { addCommentReply, toggleCommentReaction } from "@/app/clubhouse/actions";
import { ClubCrest } from "@/components/club-crest";
import type { WeeklyConversation,WeeklyReaction } from "@/lib/weekly-conversations";

const reactions:{key:WeeklyReaction;emoji:string;label:string}[]=[{key:"fire",emoji:"🔥",label:"Fire"},{key:"trash",emoji:"🗑️",label:"Trash"},{key:"eyes",emoji:"👀",label:"Watching"}];

export function WeeklyConversations({threads,currentUserId,compact=false}:{threads:WeeklyConversation[];currentUserId:string;compact?:boolean}){
  if(!threads.length)return <div className="card empty-press-room"><MessageCircle/><div><b>The press room is quiet.</b><p className="subtle">Nobody left a comment before the deadline.</p></div></div>;
  return <div className={`conversation-list${compact?" compact":""}`}>{threads.map(thread=><ConversationCard thread={thread} currentUserId={currentUserId} key={thread.submissionId}/>)}</div>;
}

function ConversationCard({thread,currentUserId}:{thread:WeeklyConversation;currentUserId:string}){
  const [reply,setReply]=useState("");const [error,setError]=useState("");const [pending,startTransition]=useTransition();
  const react=(reaction:WeeklyReaction)=>startTransition(async()=>{setError("");const result=await toggleCommentReaction({submissionId:thread.submissionId,reaction});if(result.error)setError(result.error)});
  const submit=(event:FormEvent)=>{event.preventDefault();if(!reply.trim())return;startTransition(async()=>{setError("");const result=await addCommentReply({submissionId:thread.submissionId,body:reply});if(result.error)setError(result.error);else setReply("")})};
  return <article className="card conversation-card">
    <header><ClubCrest seed={thread.userId} label={thread.name} imageUrl={thread.crestUrl} size="md"/><div><b>{thread.name}</b><span>Pre-match statement</span></div></header>
    <blockquote>{thread.commentary}</blockquote>
    <div className="reaction-row">{reactions.map(item=>{const count=thread.reactions.filter(row=>row.reaction===item.key).length;const active=thread.reactions.some(row=>row.reaction===item.key&&row.userId===currentUserId);return <button type="button" className={active?"active":""} onClick={()=>react(item.key)} disabled={pending} aria-label={item.label} key={item.key}><span>{item.emoji}</span>{count>0&&<b>{count}</b>}</button>})}</div>
    {thread.replies.length>0&&<div className="reply-list">{thread.replies.map(item=><div className="reply" key={item.id}><ClubCrest seed={item.userId} label={item.name} imageUrl={item.crestUrl} size="sm"/><div><b>{item.name}</b><p>{item.body}</p></div></div>)}</div>}
    <form className="reply-form" onSubmit={submit}><input value={reply} onChange={event=>setReply(event.target.value)} maxLength={180} placeholder="Reply…" aria-label={`Reply to ${thread.name}`}/><button disabled={pending||!reply.trim()} aria-label="Send reply"><Send size={16}/></button></form>
    {error&&<p className="form-error">{error}</p>}
  </article>;
}
