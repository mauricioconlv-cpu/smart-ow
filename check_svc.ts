import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  const { data, error } = await supabase
    .from('services')
    .select('id, folio, status, operator_id, company_id')
    .eq('folio', '12')
    
  console.log("Services Folio 12:", data, error)
  
  if (data && data.length > 0 && data[0].operator_id) {
     const { data: op } = await supabase.from('profiles').select('id, full_name, email, role, company_id').eq('id', data[0].operator_id).single()
     console.log("Operator Profile:", op)
  }
}
check()
