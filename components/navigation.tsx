"use client"

import Link from "next/link"
import Image from "next/image"

export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-80" aria-label="George home">
          <div className="relative h-16 w-44 sm:h-[72px] sm:w-48 md:h-20 md:w-56 lg:h-24 lg:w-64">
            <Image
              src="/guardx-logo.png"
              alt="GuardX"
              fill
              className="object-contain"
              priority
              sizes="(max-width: 640px) 176px, (max-width: 768px) 192px, (max-width: 1024px) 224px, 256px"
            />
          </div>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium text-[#475569] transition-colors hover:text-[#1D4ED8]">
            Meet George
          </Link>
        </div>
      </div>
    </nav>
  )
}
