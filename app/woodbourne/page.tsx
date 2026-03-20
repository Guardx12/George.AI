import { Metadata } from "next"
import { WoodbourneGeorgeLiveAssistant } from "@/components/woodbourne-george-live-assistant"

export const metadata: Metadata = {
  title: "Woodbourne Car Sales | Meet George",
  description:
    "George for Woodbourne Car Sales. A live digital salesperson that helps visitors find the right car, answer stock questions, compare options, and move into WhatsApp or an enquiry.",
}

export default function WoodbourneGeorgePage() {
  return <WoodbourneGeorgeLiveAssistant />
}
