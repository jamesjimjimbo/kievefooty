import {NextRequest,NextResponse} from "next/server";
import {syncWeeklyResults} from "@/lib/result-sync";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
export const maxDuration=30;

export async function GET(request:NextRequest){
  const authorization=request.headers.get("authorization");
  const acceptedSecrets=[process.env.CRON_SECRET,process.env.RESULT_SYNC_SECRET]
    .filter((secret):secret is string=>Boolean(secret));
  const isAuthorized=acceptedSecrets.some((secret)=>authorization===`Bearer ${secret}`);
  if(!isAuthorized){
    return NextResponse.json({error:"Unauthorized"},{status:401});
  }
  const apiKey=process.env.FOOTBALL_DATA_API_KEY;
  if(!apiKey)return NextResponse.json({error:"Football data is not configured"},{status:503});
  try{
    const result=await syncWeeklyResults(createAdminClient(),apiKey);
    return NextResponse.json({ok:true,...result});
  }catch(error){
    const message=error instanceof Error?error.message:"Result sync failed";
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}
