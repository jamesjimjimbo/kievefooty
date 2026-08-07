"use client";
import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImageUp, LoaderCircle } from "lucide-react";
import { savePlayerProfile } from "@/app/profile/actions";
import { ClubCrest } from "@/components/club-crest";
import { createClient } from "@/lib/supabase/client";

type ProfileEditorProps={
  userId:string;displayName:string;favoriteTeam:string;bio:string;motto:string;crestUrl:string|null;teams:string[];
};

const crestSize=1024;
const directUploadTypes=new Map([["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"]]);

async function normalizeCrest(file:File){
  if(file.size>20*1024*1024)throw new Error("That photo is too large. Choose one under 20MB.");
  const directExtension=directUploadTypes.get(file.type);
  if(directExtension&&file.size<=4.5*1024*1024)return {blob:file,contentType:file.type,extension:directExtension};
  const sourceUrl=URL.createObjectURL(file);
  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const element=new Image();element.onload=()=>resolve(element);element.onerror=()=>reject(new Error("This photo format could not be read. Try a screenshot or a JPG."));element.src=sourceUrl;
    });
    const side=Math.min(image.naturalWidth,image.naturalHeight);const left=(image.naturalWidth-side)/2;const top=(image.naturalHeight-side)/2;
    const canvas=document.createElement("canvas");canvas.width=crestSize;canvas.height=crestSize;
    const context=canvas.getContext("2d");if(!context)throw new Error("Your browser could not prepare this photo.");
    context.drawImage(image,left,top,side,side,0,0,crestSize,crestSize);
    let blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));
    if(!blob)throw new Error("Your browser could not resize this photo.");
    if(blob.size<=4.5*1024*1024)return {blob,contentType:"image/png",extension:"png"};
    blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.88));
    if(!blob)throw new Error("Your browser could not resize this photo.");
    return {blob,contentType:"image/jpeg",extension:"jpg"};
  }finally{URL.revokeObjectURL(sourceUrl)}
}

export function PlayerProfileEditor(props:ProfileEditorProps){
  const router=useRouter();const [error,setError]=useState("");const [message,setMessage]=useState("");const [uploading,setUploading]=useState(false);const [crestUrl,setCrestUrl]=useState(props.crestUrl);
  async function uploadCrest(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value="";if(!file)return;
    setUploading(true);setError("");setMessage("");
    try{
      const crest=await normalizeCrest(file);const supabase=createClient();
      const {data:{user}}=await supabase.auth.getUser();if(!user||user.id!==props.userId)throw new Error("Please sign in again.");
      const path=`${user.id}/crest-${Date.now()}.${crest.extension}`;
      const {error:uploadError}=await supabase.storage.from("crests").upload(path,crest.blob,{contentType:crest.contentType,upsert:false});
      if(uploadError)throw uploadError;
      const url=supabase.storage.from("crests").getPublicUrl(path).data.publicUrl;
      const {error:updateError}=await supabase.from("profiles").update({crest_url:url,crest_source:"uploaded",profile_completed_at:new Date().toISOString()}).eq("id",user.id);
      if(updateError)throw updateError;
      setCrestUrl(url);setMessage("Crest uploaded and saved.");router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"The crest could not be uploaded. Please try again.")}finally{setUploading(false)}
  }
  return <div className="profile-editor-grid">
    <form action={savePlayerProfile} className="card profile-form">
      <div><p className="eyebrow">Player identity</p><h2>Make it yours</h2><p className="subtle">This is what everyone sees in the Clubhouse.</p></div>
      <label className="field"><span>Club name</span><input name="display_name" defaultValue={props.displayName} maxLength={50} required/></label>
      <label className="field"><span>Favorite club</span><select name="favorite_team" defaultValue={props.favoriteTeam}><option value="">No allegiance declared</option>{props.teams.map(team=><option key={team}>{team}</option>)}</select></label>
      <label className="field"><span>Short bio</span><textarea name="bio" defaultValue={props.bio} maxLength={240} rows={4} placeholder="How you know the group, your football credentials, or your greatest delusion."/></label>
      <label className="field"><span>Club motto <small>(optional)</small></span><input name="motto" defaultValue={props.motto} maxLength={80} placeholder="Football heritage, allegedly"/></label>
      <button className="primary">Save player card</button>
    </form>
    <section className="card crest-upload-card">
      <div className="crest-upload-preview"><ClubCrest seed={props.userId} label={props.displayName} imageUrl={crestUrl} size="lg"/></div>
      <div><p className="eyebrow"><ImageUp size={14}/> Club badge</p><h2>{crestUrl?"Change your crest":"Add your crest"}</h2><p className="subtle">Choose any photo from your phone. We&apos;ll crop it square and shrink it automatically before uploading.</p></div>
      <label className={`crest-upload${uploading?" disabled":""}`}>{uploading?<LoaderCircle className="spin" size={20}/>:<ImageUp size={20}/>}<span><b>{uploading?"Preparing photo…":"Choose from photos"}</b><small>iPhone photos, JPG, PNG, or WebP · up to 20MB</small></span><input type="file" accept="image/*" onChange={uploadCrest} disabled={uploading}/></label>
      {message&&<p className="form-success crest-upload-status"><CheckCircle2 size={15}/>{message}</p>}
      {error&&<p className="form-error">{error}</p>}
    </section>
  </div>;
}
