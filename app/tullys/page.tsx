import type { Metadata } from "next"
import { TullysLiveAssistant } from "@/components/tullys-live-assistant"

export const metadata: Metadata = {
  title: "Tulleys Farm | ",
  description: "George for Tulleys Farm. A live English-speaking digital member of staff trained from approved Tulleys pages and related event websites.",
}

export default function TullysPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@200..700&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://use.typekit.net/ryy8yzx.css" />
      <link rel="stylesheet" href="https://www.tulleysfarm.com/css/site/site_vendor.css?id=5c7f3023b56d965427c77f20c39c8843" />
      <link rel="stylesheet" href="https://www.tulleysfarm.com/css/site/site.css?id=a8a4855a30f8668fafa21072a196dad0" />

      <main className="tulleys-exact-page min-h-screen text-[#F6E6C5]">
        <div id="page-encapsulation" className="bg-wood-texture min-h-screen">
          <div className="mx-auto max-w-[1600px] px-2 py-4 sm:px-4 lg:px-6">
            <TullysLiveAssistant />
          </div>
        </div>
      </main>
    </>
  )
}
