import type { Metadata } from "next"
import { AlderwoodGeorgeLiveAssistant } from "@/components/alderwood-george-live-assistant"

export const metadata: Metadata = {
  title: "Alderwood Ponds | Meet George",
  description:
    "Meet George for Alderwood Ponds — a friendly voice assistant for prices, rules, fish sizes, night fishing, cabins, camping, dogs and directions.",
  alternates: { canonical: "https://askgeorge.app/alderwood-ponds" },
  openGraph: {
    title: "Alderwood Ponds | Meet George",
    description:
      "Meet George for Alderwood Ponds — a friendly voice assistant for prices, rules, fish sizes, night fishing, cabins, camping, dogs and directions.",
    url: "https://askgeorge.app/alderwood-ponds",
    type: "website",
  },
}

export default function AlderwoodPondsPage() {
  return <AlderwoodGeorgeLiveAssistant />
}
