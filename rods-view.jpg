"use client"

import { usePathname } from "next/navigation"
import { BottomGeorgeBar } from "@/components/bottom-george-bar"

export function ConditionalBottomGeorgeBar() {
  const pathname = usePathname()

  if (pathname === "/tulleys" || pathname === "/tullys") {
    return null
  }

  return <BottomGeorgeBar />
}
