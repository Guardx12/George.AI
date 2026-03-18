import Link from "next/link"
import { MessageCircle, ArrowRight } from "lucide-react"

export function BottomGeorgeBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-[24px] border border-white/20 bg-[linear-gradient(135deg,rgba(15,23,42,0.97)_0%,rgba(17,24,39,0.97)_42%,rgba(29,78,216,0.97)_100%)] px-4 py-3 shadow-[0_20px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#BFDBFE] sm:text-xs">Do not lose the visitor</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-white sm:text-base">
            Talk to George now and see how he keeps visitors engaged before they leave.
          </p>
        </div>
        <Link
          href="/meet-george#live-george"
          className="get-started-btn george-bottom-bar-button inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#0F172A] transition hover:bg-[#EFF6FF] sm:px-6 sm:text-base"
        >
          <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="get-started-text">Talk to George</span>
          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </Link>
      </div>
    </div>
  )
}
