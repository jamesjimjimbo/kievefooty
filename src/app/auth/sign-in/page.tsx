import Link from "next/link";
import { signIn } from "../actions";
export default async function Page({searchParams}:{searchParams:Promise<{error?:string;message?:string;next?:string}>}){
  const params=await searchParams;
  return <main className="auth-page"><section className="auth-card">
    <div className="wordmark" style={{color:"var(--forest)",marginBottom:24}}><span className="ball-mark">⚽</span>Kieve Footy</div>
    <p className="eyebrow">Welcome back</p><h1>Into the changing room.</h1>
    <p className="subtle">Sign in to make this week&apos;s picks and see how the table is shaping up.</p>
    {params.error&&<div className="notice">{params.error}</div>}
    {params.message&&<div className="saved">{params.message}</div>}
    <form action={signIn}><input type="hidden" name="next" value={params.next??"/picks"}/>
      <label className="field">Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label>
      <label className="field">Password<input name="password" type="password" autoComplete="current-password" required minLength={8} placeholder="••••••••"/></label>
      <button className="primary" type="submit">Sign in</button>
    </form>
    <p className="subtle" style={{textAlign:"center",fontSize:13,marginTop:18}}>New to the league? <Link href="/auth/sign-up" style={{fontWeight:800,color:"var(--forest)"}}>Create your account</Link></p>
  </section></main>
}
