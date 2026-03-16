import Image from "next/image"

export function GoatleyNavigation() {
  return (
    <header className="border-b border-[#3b3933] bg-[#171717] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <a href="https://www.randdgoatley.co.uk/" aria-label="R & D Goatley home page" className="block">
          <Image
            src="/goatleys-logo.jpg"
            alt="R & D Goatley Ltd"
            width={520}
            height={120}
            className="h-auto w-[220px] max-w-full sm:w-[320px] lg:w-[420px]"
            priority
          />
        </a>

        <a
          href="tel:01273411177"
          className="shrink-0 text-base font-semibold tracking-wide text-[#f2d675] transition hover:text-white sm:text-lg"
        >
          01273 411177
        </a>
      </div>
    </header>
  )
}
