export function FishersNavigation() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#6fb54d]/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,255,240,0.92)_100%)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <a href="https://www.fishersfarmpark.co.uk/" className="min-w-0 transition hover:opacity-90" aria-label="Fishers Farm Park home page">
          <div className="text-2xl font-black tracking-tight text-[#3b7d2a] sm:text-3xl">Fishers Farm Park</div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d18f0d] sm:text-sm">Ask George</div>
        </a>
        <div className="flex items-center gap-3">
          <a
            href="https://fishersfarmpark.visihost.co.uk/"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#f3b22a] px-4 py-2 text-sm font-bold text-[#2f3c12] shadow-[0_12px_28px_rgba(243,178,42,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(243,178,42,0.35)] sm:text-base"
          >
            Buy tickets
          </a>
        </div>
      </div>
    </header>
  )
}
