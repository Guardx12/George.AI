"use client"

import { usePathname } from "next/navigation"
import { WhatsAppBubble } from "@/components/whatsapp-bubble"

export function ConditionalWhatsAppBubble() {
  const pathname = usePathname()

  if (pathname?.startsWith("/rd-goatley-george")) {
    return null
  }

  return <WhatsAppBubble />
}
