import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <h3 className="text-lg font-semibold text-[#0F172A]">Meet George</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#475569]">
          George is a trained digital member of staff for the website. He answers questions, explains services,
          gives pricing guidance, captures enquiries, and helps turn more visitors into customers.
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <Link href="/" className="text-[#475569] transition-colors hover:text-[#1D4ED8]">
            Meet George
          </Link>
          <a href="mailto:info@guardxnetwork.com" className="text-[#475569] transition-colors hover:text-[#1D4ED8]">
            info@guardxnetwork.com
          </a>
        </div>
      </div>
    </footer>
  )
}
