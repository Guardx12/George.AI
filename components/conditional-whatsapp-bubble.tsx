"use client"

import { usePathname } from "next/navigation"

  const pathname = usePathname()

  if (pathname?.startsWith("/rd-goatley-george")) {
    return null
  }

}
