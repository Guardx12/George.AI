const aboutLinks = [
  ["Home page", "https://www.randdgoatley.co.uk/"],
  ["Goatley’s Story", "https://www.randdgoatley.co.uk/goatleys-story"],
  ["Why Choose Goatley", "https://www.randdgoatley.co.uk/why-choose-goatleys"],
  ["Meet the Team", "https://www.randdgoatley.co.uk/meet-the-goatley-team"],
  ["Follow Us", "https://www.facebook.com/rdgoatley/"],
] as const

const productLinks = [
  ["Window Products", "https://www.randdgoatley.co.uk/window-products"],
  ["Door Products", "https://www.randdgoatley.co.uk/door-products"],
  ["Sliding Doors", "https://www.randdgoatley.co.uk/sliding-doors"],
  ["Aluco Aluminium", "https://www.randdgoatley.co.uk/aluco-aluminium"],
  ["Conservatories", "https://www.randdgoatley.co.uk/conservatories"],
] as const

const infoLinks = [
  ["Privacy and Cookies", "https://www.randdgoatley.co.uk/privacy-and-cookies"],
  ["Client Testimonials", "https://www.randdgoatley.co.uk/client-testimonials"],
  ["Inspiration Gallery", "https://www.randdgoatley.co.uk/inspiration-gallery"],
  ["Brochures and Downloads", "https://www.randdgoatley.co.uk/brochures"],
  ["Contact Us", "https://www.randdgoatley.co.uk/contact-us"],
] as const

export function GoatleyFooter() {
  return (
    <footer className="border-t border-[#3b3933] bg-[#161616] text-[#efe8d3]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <h3 className="text-lg font-semibold text-[#f0d57b]">About Goatleys</h3>
          <div className="mt-4 space-y-2 text-sm">
            {aboutLinks.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="block transition hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#f0d57b]">Product Range</h3>
          <div className="mt-4 space-y-2 text-sm">
            {productLinks.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="block transition hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#f0d57b]">More information</h3>
          <div className="mt-4 space-y-2 text-sm">
            {infoLinks.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="block transition hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#f0d57b]">Contact R &amp; D Goatley</h3>
          <div className="mt-4 space-y-3 text-sm leading-6">
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
      <div className="border-t border-[#2a2a2a] px-4 py-4 text-center text-xs text-[#b7b09a] sm:px-6 lg:px-8">
        © R &amp; D Goatley website - Monday 16 March, 2026. - All rights reserved - Areas we work
      </div>
    </footer>
  )
}
