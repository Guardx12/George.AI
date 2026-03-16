import Image from "next/image"
import Link from "next/link"

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
    <header className="sticky top-0 z-50 border-b border-[#3b3933] bg-[#171717]/95 text-white backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-5">
            <Link href="/rd-goatley-george" aria-label="R & D Goatley George page" className="block">
              <Image
                src="/goatleys-logo.jpg"
                alt="R & D Goatley Ltd"
                width={520}
                height={120}
                className="h-auto w-[260px] max-w-full sm:w-[360px] lg:w-[420px]"
                priority
              />
            </Link>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#e5d49a] sm:text-[15px]">
              {navItems.map((item, index) => (
                <span key={item.label} className="flex items-center gap-x-3">
                  <a href={item.href} target="_blank" rel="noreferrer" className="transition hover:text-white">
                    {item.label}
                  </a>
                  {index < navItems.length - 1 ? <span className="text-[#8c7c46]">|</span> : null}
                </span>
              ))}
            </div>
            <a href="tel:01273411177" className="text-lg font-semibold tracking-wide text-[#f2d675] transition hover:text-white">
              01273 411177
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}
