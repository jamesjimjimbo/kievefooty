import type { Metadata } from "next";
import { PicksFlow } from "@/components/picks-flow";
export const metadata:Metadata={title:"Picks"};
export default function PicksPage(){return <PicksFlow/>}
