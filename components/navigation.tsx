"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import Image from "next/image"

const links = [
  { href: "/", label: "Home" },
  { href: "/meet-george", label: "" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
]

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
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
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#475569] transition-colors hover:text-[#1D4ED8]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white p-2 text-[#0F172A] shadow-sm md:hidden"
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-[#E5E7EB] bg-white md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-4 sm:px-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-[#475569] transition-colors hover:bg-[#EFF6FF] hover:text-[#1D4ED8]"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
