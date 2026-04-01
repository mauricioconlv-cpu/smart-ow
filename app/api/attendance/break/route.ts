import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setBreakStatus } from '@/lib/attendance'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { isBreak } = await req.json()
    await setBreakStatus(supabase, user.id, isBreak)

    return NextResponse.json({ success: true, isBreak })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
