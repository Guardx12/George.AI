import type { Metadata } from "next"
import { Dumbbell, MapPin, Phone, Clock3, Waves, Users, Accessibility, CalendarRange, ChevronRight } from "lucide-react"
import { PlacesForPeopleGeorgeLiveAssistant } from "@/components/placesforpeople-george-live-assistant"

export const metadata: Metadata = {
  title: "Steyning Leisure Centre | Meet George",
  description:
    "A Steyning Leisure Centre themed George page with centre information, memberships, facilities, timetable access, and a live assistant for gym, swimming, classes, and visitor questions.",
  alternates: { canonical: "https://askgeorge.app/placesforpeople" },
  openGraph: {
    title: "Steyning Leisure Centre | Meet George",
    description:
      "A Steyning Leisure Centre themed George page with centre information, memberships, facilities, timetable access, and a live assistant for gym, swimming, classes, and visitor questions.",
    url: "https://askgeorge.app/placesforpeople",
    type: "website",
  },
}

const memberships = [
  { name: "Premium", description: "Includes gym, swim and classes with 15 days' advanced booking from the start time of your session.", price: "From £55.5 per month" },
  { name: "Swim", description: "Includes swimming with 15 days' advance booking rights from the session start time for bookable activities.", price: "From £34 per month" },
  { name: "Premium 16-18", description: "Includes gym, swim and classes with 15 days' advanced booking from the start time of your session.", price: "From £30 per month" },
  { name: "Premium 19-25", description: "Includes gym, swim and classes with 15 days' advanced booking from the start time of your session.", price: "From £35 per month" },
  { name: "Gym", description: "Includes gym access with 15 days' advance booking rights from the session start time for bookable activities.", price: "From £34 per month" },
]

const courses = [
  {
    name: "Swimming lessons",
    availability: "Available at this centre",
    description:
      "Confidence-building lessons for children and adults, helping people learn water skills for life in a supportive, active environment.",
  },
  {
    name: "Gymnastics",
    availability: "Available at this centre",
    description:
      "A progressive programme that helps build flexibility, balance, strength, confidence and coordination in a fun setting.",
  },
  {
    name: "Badminton",
    availability: "Nearest centre availability",
    description:
      "Fast, social and easy to start. A full-body racket sport that suits a wide range of ages and abilities.",
  },
  {
    name: "Trampolining",
    availability: "Nearest centre availability",
    description:
      "Energetic sessions designed to build coordination, strength, confidence and movement skills in a fun way.",
  },
]

const facilities = ["Gym", "Pools", "Studio(s)", "Indoor cycling studio", "Squash court(s)", "Sports hall", "Meeting room(s)", "Outdoor courts"]
const accessibility = [
  "Accessible parking",
  "Hearing induction loop",
  "Accessible shower",
  "Accessible change",
  "Changing places",
  "Pool hoist",
  "Accessible pool chair",
  "Accessible pool steps",
  "Assistance dogs welcome",
]
const openingTimes = [
  "Monday: 6.30am - 9.00pm",
  "Tuesday: 6.30am - 9.00pm",
  "Wednesday: 6.30am - 9.00pm",
  "Thursday: 6.30am - 9.00pm",
  "Friday: 6.30am - 9.00pm",
  "Saturday: 7.00am - 5.00pm",
  "Sunday: 8.00am - 5.00pm",
]

const workoutModes = [
  { title: "Beginner support", copy: "George checks whether someone is a beginner, intermediate or advanced, then keeps the workout simple, safe and easy to follow." },
  { title: "Guided sessions", copy: "If someone says something like biceps and triceps, fat loss or full body, George can build a session and guide them through it one exercise at a time." },
  { title: "Safety-first coaching", copy: "George gives a rough form guide in plain English and reminds visitors to ask a member of staff if they are unsure at any point." },
]

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1a7367]">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-[#173632] sm:text-4xl">{title}</h2>
      {copy ? <p className="mt-4 text-base leading-7 text-[#5a6b68] sm:text-lg">{copy}</p> : null}
    </div>
  )
}

export default function PlacesForPeoplePage() {
  return (
    <main className="min-h-screen bg-[#f3f7f6] text-[#173632]">
      <div className="bg-[#0d4e47] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-5">
            <a href="https://www.placesleisure.org/our-purpose" className="transition hover:text-[#bcece4]">Our purpose</a>
            <a href="https://www.placesleisure.org/our-people" className="transition hover:text-[#bcece4]">Our people</a>
            <a href="https://www.placesleisure.org/our-centres" className="transition hover:text-[#bcece4]">Our centres</a>
            <a href="https://placesleisure.gladstonego.cloud/" className="transition hover:text-[#bcece4]">Join now</a>
            <a href="https://www.placesleisure.org/contact-us" className="transition hover:text-[#bcece4]">Contact us</a>
          </div>
          <div className="text-sm font-semibold tracking-[0.2em] uppercase">Places Leisure</div>
        </div>
      </div>

      <div className="border-b border-[#d5e3df] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1a7367]">Steyning Leisure Centre</div>
              <div className="mt-2 text-sm text-[#5b6c69]">Closes today at 9.00pm</div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-medium text-[#244542]">
              <a href="https://www.placesleisure.org/activities/swimming" className="rounded-full bg-[#eff7f4] px-4 py-2 transition hover:bg-[#e2f2ed]">Swimming &amp; Lessons</a>
              <a href="https://www.placesleisure.org/activities/fitness-and-health" className="rounded-full bg-[#eff7f4] px-4 py-2 transition hover:bg-[#e2f2ed]">Fitness &amp; Health</a>
              <a href="https://www.placesleisure.org/activities/sports" className="rounded-full bg-[#eff7f4] px-4 py-2 transition hover:bg-[#e2f2ed]">Sports</a>
              <a href="https://www.placesleisure.org/activities/family-and-kids" className="rounded-full bg-[#eff7f4] px-4 py-2 transition hover:bg-[#e2f2ed]">Family &amp; Kids</a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-[#d5e3df] bg-[#ecf7f3]">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0f5f56]">Partial Pool Closure</div>
          <p className="mt-2 max-w-5xl text-sm leading-7 text-[#355552] sm:text-base">
            Please be aware that part of the pool is closed until further notice due to a fault with the movable floor.
            All lane swims will operate as general swim only, and only half of the pool will be available.
          </p>
        </div>
      </div>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-14">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1a7367]">Welcome to Steyning Leisure Centre</div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-[#173632] sm:text-5xl lg:text-6xl">
              Meet George for Steyning Leisure Centre
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[#5a6b68] sm:text-lg">
              Steyning Leisure Centre in West Sussex offers a modern gym, fitness classes, sports facilities and
              community activities for all ages. This version keeps the same overall feel while adding George as a
              trained digital member of staff for memberships, classes, gym help, swim questions, centre information,
              and visitor guidance.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a href="https://placesleisure.gladstonego.cloud/Pages/BookingsPage?centerId=1066" className="rounded-full bg-[#0f5f56] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105">Join today</a>
              <a href="https://placesleisure.gladstonego.cloud/" className="rounded-full border border-[#d3e2dd] bg-white px-6 py-3 text-sm font-semibold text-[#244542] transition hover:bg-[#f7fbfa]">Login to your account</a>
              <a href="https://www.placesleisure.org/contact-us" className="rounded-full border border-[#d3e2dd] bg-white px-6 py-3 text-sm font-semibold text-[#244542] transition hover:bg-[#f7fbfa]">Contact us</a>
              <a href="https://www.placesleisure.org/centres/steyning-leisure-centrex/timetable" className="rounded-full border border-[#d3e2dd] bg-white px-6 py-3 text-sm font-semibold text-[#244542] transition hover:bg-[#f7fbfa]">View timetable</a>
            </div>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-[#d5e3df] bg-[linear-gradient(145deg,#0f5f56_0%,#17816f_52%,#c6efe5_100%)] p-6 text-white shadow-[0_24px_60px_rgba(15,95,86,0.24)]">
            <div className="inline-flex items-center rounded-full bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">Centre information</div>
            <div className="mt-6 space-y-5">
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">General manager</div>
                  <div className="text-white/85">Simon Crute</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">Call us</div>
                  <div className="text-white/85">01903 879666</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">Address</div>
                  <div className="text-white/85">Horsham Road, Steyning, West Sussex, BN44 3AA</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">Today</div>
                  <div className="text-white/85">Open now · closes at 9.00pm</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <PlacesForPeopleGeorgeLiveAssistant />
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <SectionHeading
            eyebrow="Memberships"
            title="Memberships for everyone"
            copy="We offer a range of payment options and discounted memberships. Choose the package that fits how you want to use the centre."
          />
          <div className="mt-8 grid gap-5 lg:grid-cols-5">
            {memberships.map((membership) => (
              <div key={membership.name} className="rounded-[28px] border border-[#dbe8e3] bg-[#f8fbfa] p-6 shadow-sm">
                <div className="text-xl font-bold text-[#173632]">{membership.name}</div>
                <p className="mt-3 text-sm leading-7 text-[#5a6b68]">{membership.description}</p>
                <div className="mt-6 text-base font-semibold text-[#0f5f56]">{membership.price}</div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <a href="https://placesleisure.gladstonego.cloud/Pages/BookingsPage?centerId=1066" className="inline-flex items-center gap-2 rounded-full bg-[#0f5f56] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105">
              Join now <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <SectionHeading
          eyebrow="Courses"
          title="Available activities and courses"
          copy="Structured in the same broad style as the live centre page, with room for George to guide visitors to the right option."
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {courses.map((course) => (
            <div key={course.name} className="rounded-[28px] border border-[#dbe8e3] bg-white p-6 shadow-sm">
              <div className="text-xl font-bold text-[#173632]">{course.name}</div>
              <div className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#1a7367]">{course.availability}</div>
              <p className="mt-4 text-sm leading-7 text-[#5a6b68]">{course.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <SectionHeading eyebrow="Centre info" title="Centre information" />
          <div className="mt-8 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[28px] border border-[#dbe8e3] bg-[#f8fbfa] p-6">
              <div className="flex items-center gap-3 text-lg font-bold text-[#173632]"><MapPin className="h-5 w-5 text-[#0f5f56]" /> Address</div>
              <p className="mt-4 text-sm leading-7 text-[#5a6b68]">Horsham Road, Steyning, West Sussex, BN44 3AA</p>
              <p className="mt-3 text-sm leading-7 text-[#5a6b68]">What3Words: ///starlight.chuck.storage</p>
            </div>
            <div className="rounded-[28px] border border-[#dbe8e3] bg-[#f8fbfa] p-6">
              <div className="flex items-center gap-3 text-lg font-bold text-[#173632]"><Clock3 className="h-5 w-5 text-[#0f5f56]" /> Opening times</div>
              <div className="mt-4 space-y-2 text-sm leading-7 text-[#5a6b68]">
                {openingTimes.map((time) => <div key={time}>{time}</div>)}
              </div>
            </div>
            <div className="rounded-[28px] border border-[#dbe8e3] bg-[#f8fbfa] p-6">
              <div className="flex items-center gap-3 text-lg font-bold text-[#173632]"><Dumbbell className="h-5 w-5 text-[#0f5f56]" /> Facilities</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {facilities.map((item) => <span key={item} className="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#355552]">{item}</span>)}
              </div>
            </div>
            <div className="rounded-[28px] border border-[#dbe8e3] bg-[#f8fbfa] p-6">
              <div className="flex items-center gap-3 text-lg font-bold text-[#173632]"><Accessibility className="h-5 w-5 text-[#0f5f56]" /> Accessibility</div>
              <div className="mt-4 space-y-2 text-sm leading-7 text-[#5a6b68]">
                {accessibility.map((item) => <div key={item}>{item}</div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[30px] border border-[#dbe8e3] bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-[#1a7367]"><CalendarRange className="h-4 w-4" /> Timetable</div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-[#173632]">Ready for your Google Sheet link</h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#5a6b68]">
              This section is ready for the live class and schedule link you plan to add later. For now, George can guide
              visitors to the main timetable page, and once the sheet link is added into the page or the route notes,
              George can use that as the latest source for classes and session times.
            </p>
            <div className="mt-6 rounded-[22px] border border-dashed border-[#b7d7cf] bg-[#f8fbfa] p-5 text-sm leading-7 text-[#355552]">
              Placeholder for published Google Sheet link, class blocks, swim times, bookable sessions, and any staff-updated schedules.
            </div>
          </div>

          <div className="rounded-[30px] border border-[#dbe8e3] bg-[linear-gradient(145deg,#103d39_0%,#0f5f56_46%,#177d70_100%)] p-7 text-white shadow-[0_24px_60px_rgba(15,95,86,0.22)]">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c9f4ea]">George can handle</div>
            <h3 className="mt-3 text-2xl font-black tracking-tight">Gym help, swim questions, memberships, directions and more</h3>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Membership guidance",
                "Gym and workout ideas",
                "Swimming and classes",
                "Facilities and accessibility",
                "Opening times",
                "General centre questions",
                "Landmark-based centre guidance",
                "Next-step recommendations",
              ].map((item) => (
                <div key={item} className="rounded-[18px] bg-white/10 px-4 py-4 text-sm font-medium text-white/95">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-14">
          <div className="rounded-[30px] border border-[#dbe8e3] bg-[#f8fbfa] p-7">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-[#1a7367]"><Waves className="h-4 w-4" /> Places Leisure app</div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-[#173632]">Manage bookings and workouts</h3>
            <p className="mt-4 text-base leading-7 text-[#5a6b68]">
              The live centre page also pushes the Places Leisure app for bookings, digital fitness and general account
              access. This block keeps that same style of journey on the George page.
            </p>
            <a href="https://www.placesleisure.org/places-leisure-app" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0f5f56] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105">
              Download now <ChevronRight className="h-4 w-4" />
            </a>
          </div>
          <div className="rounded-[30px] border border-[#dbe8e3] bg-[#f8fbfa] p-7">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-[#1a7367]"><Phone className="h-4 w-4" /> Contact us</div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-[#173632]">Need more help?</h3>
            <p className="mt-4 text-base leading-7 text-[#5a6b68]">
              If a visitor wants more detail on membership choice, joining, the centre facilities or a next step, this page
              still keeps the direct contact route alongside George.
            </p>
            <a href="https://www.placesleisure.org/contact-us" className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#d3e2dd] bg-white px-6 py-3 text-sm font-semibold text-[#244542] transition hover:bg-[#f7fbfa]">
              Contact us <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
