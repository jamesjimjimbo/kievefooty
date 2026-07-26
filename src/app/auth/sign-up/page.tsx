import Link from "next/link";
import { headers } from "next/headers";
import { signUp } from "../actions";
export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}){
  const params=await searchParams;const headerStore=await headers();
  const origin=headerStore.get("origin")??process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000";
  return <main className="auth-page"><section className="auth-card">
    <div className="wordmark" style={{color:"var(--forest)",marginBottom:24}}><span className="ball-mark">⚽</span>Kieve Footy</div>
    <p className="eyebrow">Join the competition</p><h1>Claim your shirt.</h1><p className="subtle">Create the account you&apos;ll use for picks, challenges and the table.</p>
    {params.error&&<div className="notice">{params.error}</div>}
    <form action={signUp}><input type="hidden" name="origin" value={origin}/>
      <label className="field">Display name<input name="display_name" required maxLength={50} placeholder="James"/></label>
      <label className="field">Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label>
      <label className="field">Password<input name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters"/></label>
      <button className="primary" type="submit">Create account</button>
    </form>
    <p className="subtle" style={{textAlign:"center",fontSize:13,marginTop:18}}>Already registered? <Link href="/auth/sign-in" style={{fontWeight:800,color:"var(--forest)"}}>Sign in</Link></p>
  </section></main>
}
