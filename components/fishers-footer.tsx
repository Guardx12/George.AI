const exploreLinks = [
  ["Plan your visit", "https://www.fishersfarmpark.co.uk/plan-your-visit"],
  ["Food", "https://www.fishersfarmpark.co.uk/food"],
  ["Attractions", "https://www.fishersfarmpark.co.uk/attractions"],
  ["Animals", "https://www.fishersfarmpark.co.uk/animals"],
  ["Events", "https://www.fishersfarmpark.co.uk/events"],
] as const

const stayLinks = [
  ["Holiday cottages", "https://www.fishersfarmpark.co.uk/holiday-cottages"],
  ["Luxury pods", "https://www.fishersfarmpark.co.uk/posh-pods"],
  ["Annual Pass", "https://www.fishersfarmpark.co.uk/"],
  ["Gift vouchers", "https://fishersfarmpark.visihost.co.uk/"],
] as const

export function FishersFooter() {
  return (
    <footer className="border-t border-[#6fb54d]/25 bg-[#2b4f1c] text-[#f4f8e8]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <h3 className="text-lg font-bold text-[#ffd465]">Explore Fishers</h3>
          <div className="mt-4 space-y-2 text-sm">
            {exploreLinks.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="block transition hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#ffd465]">Tickets & stays</h3>
          <div className="mt-4 space-y-2 text-sm">
            {stayLinks.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="block transition hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#ffd465]">Contact Fishers</h3>
          <div className="mt-4 space-y-3 text-sm leading-6">
            <p>
              Fishers Farm Park
              <br />
              Newpound Lane
              <br />
              Wisborough Green
              <br />
              West Sussex
              <br />
              RH14 0EG
            </p>
            <p>
              <a href="tel:01403700063" className="transition hover:text-white">
                01403 700 063
              </a>
              <br />
              <a href="mailto:info@fishersfarmpark.co.uk" className="transition hover:text-white">
                info@fishersfarmpark.co.uk
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
