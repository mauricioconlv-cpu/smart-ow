import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logClockOut } from '@/lib/attendance'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      await logClockOut(supabase, user.id)
      await supabase.auth.signOut()
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
