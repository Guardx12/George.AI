import Link from "next/link"
import Image from "next/image"

const navItems = [
  { label: "Our Story", href: "https://www.randdgoatley.co.uk/goatleys-story" },
  { label: "Why Choose Us", href: "https://www.randdgoatley.co.uk/why-choose-goatleys" },
  { label: "Windows", href: "https://www.randdgoatley.co.uk/window-products" },
  { label: "Doors", href: "https://www.randdgoatley.co.uk/door-products" },
  { label: "Conservatories", href: "https://www.randdgoatley.co.uk/conservatories" },
  { label: "Pergolas", href: "https://www.randdgoatley.co.uk/pergolas" },
  { label: "Contact Us", href: "https://www.randdgoatley.co.uk/contact-us" },
]

export function GoatleyNavigation() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#5a4b1a] bg-[#171717]/95 text-[#f4d777] backdrop-blur supports-[backdrop-filter]:bg-[#171717]/88">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 py-4 lg:py-5">
          <div className="flex items-center justify-between gap-4">
            <Link href="/rd-goatley-george" className="transition-opacity hover:opacity-90" aria-label="R & D Goatley George page">
              <Image
                src="/goatleys-logo.jpg"
                alt="R & D Goatley Ltd"
                width={523}
                height={155}
                priority
                className="h-14 w-auto sm:h-16 lg:h-20"
              />
            </Link>
            <a
              href="tel:01273411177"
              className="hidden rounded-full border border-[#8c7330] px-4 py-2 text-sm font-semibold tracking-[0.08em] text-[#f6e2a0] transition hover:border-[#d7b14a] hover:text-white sm:inline-flex"
            >
              01273 411177
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#3b3318] pt-3 text-sm sm:gap-x-5 lg:text-[15px]">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#f4d777] transition hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
