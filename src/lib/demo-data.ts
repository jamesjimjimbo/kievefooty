export type Outcome = "home" | "draw" | "away";
export type Fixture = {
  id: string; home: string; away: string; kickoff: string; gotw?: boolean;
  odds: Record<Outcome, number>;
};
export const currentWeek = { id:"week-4", number:4, label:"The Run-In Begins", lock:"Saturday · 10:00 AM", bankroll:42.5 };
export const fixtures: Fixture[] = [
  {id:"ars-liv",home:"Arsenal",away:"Liverpool",kickoff:"Sat · 12:30 PM",gotw:true,odds:{home:2.10,draw:3.40,away:3.25}},
  {id:"bha-che",home:"Brighton",away:"Chelsea",kickoff:"Sat · 3:00 PM",odds:{home:3.10,draw:3.35,away:2.20}},
  {id:"eve-tot",home:"Everton",away:"Tottenham",kickoff:"Sat · 5:30 PM",odds:{home:2.90,draw:3.50,away:2.35}},
  {id:"mun-new",home:"Man United",away:"Newcastle",kickoff:"Sun · 2:00 PM",odds:{home:2.45,draw:3.30,away:2.75}},
];
export const players = [
  {name:"James",initials:"JM",first:14.5,second:0,overall:24.5,form:"W W L",me:true},
  {name:"Owen",initials:"OB",first:12,second:0,overall:22,form:"W D W"},
  {name:"Dave",initials:"DH",first:8.5,second:0,overall:18.5,form:"L W W"},
  {name:"Charlie",initials:"CP",first:6,second:0,overall:16,form:"W L D"},
  {name:"Alex",initials:"AR",first:4,second:0,overall:4,form:"D L W"},
  {name:"Sam",initials:"SK",first:-2,second:0,overall:-12,form:"L W L"},
];
export const weeks = [
  {n:1,title:"Opening Weekend",date:"Aug 15–18",state:"done",note:"Settled · James +8.5"},
  {n:2,title:"Early Doors",date:"Aug 22–25",state:"done",note:"Settled · Owen +6"},
  {n:3,title:"Bank Holiday Ball",date:"Aug 29–Sep 1",state:"done",note:"Settled · Charlie +5"},
  {n:"🌍",title:"International Break",date:"Sep 2–12",state:"break",note:"No picks this week"},
  {n:4,title:"The Run-In Begins",date:"Sep 13–15",state:"current",note:"Picks lock Sat · 10:00 AM"},
  {n:5,title:"Back At It",date:"Sep 20–22",state:"",note:"Opens Monday"},
  {n:6,title:"Six-Pointer",date:"Sep 27–29",state:"",note:"Upcoming"},
  {n:"🎰",title:"Holiday Casino",date:"Dec 26–28",state:"break",note:"Future special week"},
];
