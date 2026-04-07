"use client"

import { usePathname } from "next/navigation"
import { Bubble } from "@/components/-bubble"

export function ConditionalBubble() {
  const pathname = usePathname()

  if (pathname === "/tulleys" || pathname === "/tullys") {
    return null
  }

  return <Bubble />
}
