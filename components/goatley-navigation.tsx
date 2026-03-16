import Image from "next/image"

export function GoatleyNavigation() {
  return (
    <header className="border-b border-[#d7b65d]/20 bg-[linear-gradient(180deg,rgba(22,22,22,0.98)_0%,rgba(9,9,9,0.98)_100%)] text-white shadow-[0_16px_45px_rgba(0,0,0,0.35)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <a href="https://www.randdgoatley.co.uk/" aria-label="R & D Goatley home page" className="block transition hover:opacity-95">
          <Image
            src="/goatleys-logo.jpg"
            alt="R & D Goatley Ltd"
            width={520}
            height={120}
            className="h-auto w-[220px] max-w-full drop-shadow-[0_10px_25px_rgba(0,0,0,0.35)] sm:w-[320px] lg:w-[420px]"
            priority
          />
        </a>

        <a
          href="tel:01273411177"
          className="shrink-0 rounded-full border border-[#f0cb6d]/25 bg-[#15110a] px-4 py-2 text-base font-semibold tracking-wide text-[#f2d675] shadow-[0_14px_32px_rgba(0,0,0,0.28)] transition hover:border-[#f0cb6d]/45 hover:text-white sm:text-lg"
        >
          01273 411177
        </a>
      </div>
    </header>
  )
}
