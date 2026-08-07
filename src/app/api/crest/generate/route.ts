import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export const maxDuration=120;

export async function POST(request:Request){
  const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Supabase is not configured"},{status:503});
  const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Please sign in again"},{status:401});
  const body=await request.json().catch(()=>null) as {prompt?:unknown}|null;
  const prompt=typeof body?.prompt==="string"?body.prompt.trim():"";
  if(prompt.length<10||prompt.length>500)return NextResponse.json({error:"Describe your crest in 10 to 500 characters"},{status:400});
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return NextResponse.json({error:"AI crest generation is not configured yet. Upload a crest for now."},{status:503});
  const imageResponse=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({
    model:"gpt-image-2",size:"1024x1024",quality:"medium",output_format:"webp",output_compression:85,n:1,
    prompt:`Create a polished square football club crest for a private friends league. ${prompt}. Bold, playful, distinctive, premium sports-brand finish, centered badge, simple shapes, strong contrast, clean background, no words, no letters, no numbers, no trademarks, no real club logos.`,
  })});
  const imageResult=await imageResponse.json().catch(()=>null) as {data?:Array<{b64_json?:string}>;error?:{message?:string}}|null;
  const encoded=imageResult?.data?.[0]?.b64_json;
  if(!imageResponse.ok||!encoded)return NextResponse.json({error:imageResult?.error?.message??"The crest studio could not finish that design"},{status:502});
  const path=`${user.id}/crest-ai-${Date.now()}.webp`;
  const {error:uploadError}=await supabase.storage.from("crests").upload(path,Buffer.from(encoded,"base64"),{contentType:"image/webp",upsert:false});
  if(uploadError)return NextResponse.json({error:uploadError.message},{status:500});
  const url=supabase.storage.from("crests").getPublicUrl(path).data.publicUrl;
  const {error:updateError}=await supabase.from("profiles").update({crest_url:url,crest_source:"generated",profile_completed_at:new Date().toISOString()}).eq("id",user.id);
  if(updateError)return NextResponse.json({error:updateError.message},{status:500});
  return NextResponse.json({url});
}
