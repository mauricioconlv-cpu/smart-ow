import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Si no hay usuario y trata de ir a rutas protegidas (dashboard u operator)
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  
  // Si hay usuario y está en root, depende de su rol pasarlo a su portal
  if (user && request.nextUrl.pathname === '/') {
     // Fetch profile for role
     const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
     
     const url = request.nextUrl.clone()
     if (profile?.role === 'admin' || profile?.role === 'dispatcher') {
        url.pathname = '/dashboard'
     } else {
        url.pathname = '/operator'
     }
     return NextResponse.redirect(url)
  }
  
  // Si hay usuario y trata de ir a login
  if (user && request.nextUrl.pathname.startsWith('/login')) {
     const url = request.nextUrl.clone()
     url.pathname = '/'
     return NextResponse.redirect(url)
  }

  return supabaseResponse
}
