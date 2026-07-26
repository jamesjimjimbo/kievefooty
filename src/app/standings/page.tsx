import type { Metadata } from "next";import { StandingsBoard } from "@/components/standings-board";
export const metadata:Metadata={title:"Standings"};export default function Page(){return <StandingsBoard/>}
