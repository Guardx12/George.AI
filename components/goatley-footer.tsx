const footerLinksLeft = [
  ["Home page", "https://www.randdgoatley.co.uk/"],
  ["Goatley's Story", "https://www.randdgoatley.co.uk/goatleys-story"],
  ["Why Choose Goatley", "https://www.randdgoatley.co.uk/why-choose-goatleys"],
  ["Meet the Team", "https://www.randdgoatley.co.uk/meet-the-goatley-team"],
  ["Follow Us", "https://www.facebook.com/randdgoatley"],
] as const

const footerLinksMiddle = [
  ["Window Products", "https://www.randdgoatley.co.uk/window-products"],
  ["Door Products", "https://www.randdgoatley.co.uk/door-products"],
  ["Sliding Doors", "https://www.randdgoatley.co.uk/sliding-doors"],
  ["Aluco Aluminium", "https://www.randdgoatley.co.uk/aluco-aluminium"],
  ["Conservatories", "https://www.randdgoatley.co.uk/conservatories"],
] as const

const footerLinksRight = [
  ["Privacy and Cookies", "https://www.randdgoatley.co.uk/privacy-and-cookies"],
  ["Client Testimonials", "https://www.randdgoatley.co.uk/client-testimonials"],
  ["Inspiration Gallery", "https://www.randdgoatley.co.uk/inspiration-gallery"],
  ["Brochures and Downloads", "https://www.randdgoatley.co.uk/brochures-and-downloads"],
  ["Contact Us", "https://www.randdgoatley.co.uk/contact-us"],
] as const

export function GoatleyFooter() {
  return (
    <footer className="border-t border-[#4a401f] bg-[#151515] text-[#f4ecd2]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <h3 className="font-serif text-xl text-[#e4c15a]">About Goatleys</h3>
            <div className="mt-4 space-y-2 text-sm text-[#f4ecd2]/85">
              {footerLinksLeft.map(([label, href]) => (
                <div key={label}>
                  <a href={href} target="_blank" rel="noreferrer" className="transition hover:text-white">
                    {label}
                  </a>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-serif text-xl text-[#e4c15a]">Product Range</h3>
            <div className="mt-4 space-y-2 text-sm text-[#f4ecd2]/85">
              {footerLinksMiddle.map(([label, href]) => (
                <div key={label}>
                  <a href={href} target="_blank" rel="noreferrer" className="transition hover:text-white">
                    {label}
                  </a>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-serif text-xl text-[#e4c15a]">More information</h3>
            <div className="mt-4 space-y-2 text-sm text-[#f4ecd2]/85">
              {footerLinksRight.map(([label, href]) => (
                <div key={label}>
                  <a href={href} target="_blank" rel="noreferrer" className="transition hover:text-white">
                    {label}
                  </a>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-serif text-xl text-[#e4c15a]">Contact R & D Goatley</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[#f4ecd2]/85">
              <p>
                Unit 3 William Street Trading Estate
                <br />
                William Street
                <br />
                Portslade
                <br />
                East Sussex
                <br />
                BN41 1PZ
              </p>
              <p>
                <a href="tel:01273411177" className="transition hover:text-white">
                  01273 411177
                </a>
                <br />
                <a href="mailto:info@windowsinsussex.co.uk" className="transition hover:text-white">
                  info@windowsinsussex.co.uk
                </a>
              </p>
            </div>
          </div>
        </div>
        <p className="mt-10 border-t border-[#2f2a1a] pt-6 text-sm text-[#f4ecd2]/60">
          © R & D Goatley website - All rights reserved.
        </p>
      </div>
    </footer>
  )
}
