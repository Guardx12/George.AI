import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? ""
  const pathname = request.nextUrl.pathname

  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")

  if (isStaticAsset) {
    return NextResponse.next()
  }

  if (["fishers.george.app", "fishers.askgeorge.app"].includes(host)) {
    const url = request.nextUrl.clone()
    url.pathname = "/fishers-george"
    return NextResponse.rewrite(url)
  }

  if (["goatleys.george.app", "goatleys.askgeorge.app"].includes(host)) {
    const url = request.nextUrl.clone()
    url.pathname = "/rd-goatley-george"
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
