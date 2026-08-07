"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload } from "lucide-react";
import { savePlayerProfile } from "@/app/profile/actions";
import { ClubCrest } from "@/components/club-crest";

type ProfileEditorProps={
  userId:string;displayName:string;favoriteTeam:string;bio:string;motto:string;crestUrl:string|null;teams:string[];
};

export function PlayerProfileEditor(props:ProfileEditorProps){
  const router=useRouter();const [prompt,setPrompt]=useState("");const [generating,setGenerating]=useState(false);const [error,setError]=useState("");const [crestUrl,setCrestUrl]=useState(props.crestUrl);
  async function generateCrest(){
    if(prompt.trim().length<10){setError("Give the badge a little more detail first.");return}
    setGenerating(true);setError("");
    try{
      const response=await fetch("/api/crest/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
      const result=await response.json() as {url?:string;error?:string};
      if(!response.ok||!result.url)throw new Error(result.error??"Crest generation failed");
      setCrestUrl(result.url);setPrompt("");router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"Crest generation failed")}finally{setGenerating(false)}
  }
  return <div className="profile-editor-grid">
    <form action={savePlayerProfile} className="card profile-form">
      <div><p className="eyebrow">Player identity</p><h2>Make it yours</h2><p className="subtle">This is what everyone sees in the Clubhouse.</p></div>
      <label className="field"><span>Club name</span><input name="display_name" defaultValue={props.displayName} maxLength={50} required/></label>
      <label className="field"><span>Favorite club</span><select name="favorite_team" defaultValue={props.favoriteTeam}><option value="">No allegiance declared</option>{props.teams.map(team=><option key={team}>{team}</option>)}</select></label>
      <label className="field"><span>Short bio</span><textarea name="bio" defaultValue={props.bio} maxLength={240} rows={4} placeholder="How you know the group, your football credentials, or your greatest delusion."/></label>
      <label className="field"><span>Club motto <small>(optional)</small></span><input name="motto" defaultValue={props.motto} maxLength={80} placeholder="Football heritage, allegedly"/></label>
      <label className="crest-upload"><Upload size={20}/><span><b>Upload a crest</b><small>JPG, PNG, or WebP · 5MB max</small></span><input name="crest" type="file" accept="image/jpeg,image/png,image/webp"/></label>
      <button className="primary">Save player card</button>
    </form>
    <section className="card crest-studio">
      <div className="crest-studio-preview"><ClubCrest seed={props.userId} label={props.displayName} imageUrl={crestUrl} size="lg"/></div>
      <div><p className="eyebrow"><Sparkles size={14}/> AI crest studio</p><h2>Describe your badge</h2><p className="subtle">Give it a mascot, colors, symbols, and attitude. The result saves straight to your player card.</p></div>
      <label className="field"><span>Your idea</span><textarea value={prompt} onChange={event=>setPrompt(event.target.value)} maxLength={500} rows={5} placeholder="A furious lobster in a vintage football shirt, navy and orange, holding a tiny trophy…"/></label>
      <div className="character-count">{prompt.length}/500</div>
      {error&&<p className="form-error">{error}</p>}
      <button type="button" className="secondary" onClick={generateCrest} disabled={generating}>{generating?"Designing your crest…":"Generate crest"}</button>
      <p className="microcopy">AI generation may take about a minute. Avoid asking it to render words—the motto lives beside the badge.</p>
    </section>
  </div>;
}
