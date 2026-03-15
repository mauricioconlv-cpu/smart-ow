import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  console.log('\n--- PROFILES ---')
  const { data: p } = await supabase.from('profiles').select('id, full_name, role, company_id, updated_at')
  console.log(JSON.stringify(p, null, 2))

  console.log('\n--- TOW TRUCKS ---')
  const { data: t } = await supabase.from('tow_trucks').select('id, economic_number, company_id, current_location, last_location_update')
  console.log(JSON.stringify(t, null, 2))
}

run()
