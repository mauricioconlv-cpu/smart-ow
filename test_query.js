const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2];
  return acc;
}, {});

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase
      .from('medical_services')
      .select(`
        id, folio, folio_prefix, service_type, status,
        patient_name, patient_phone, patient_address, patient_coords,
        symptoms, scheduled_at, follow_up_notes,
        cobro_cliente, costo_consulta,
        diagnostico, tratamiento, medicamento_recetado,
        signos_vitales, notas_medico, firma_paciente_url, fotos_evidencia,
        doctor:medical_providers(full_name, specialty)
      `)
      .limit(1)

  console.log('Error:', error)
  console.log('Data:', data)
}

run()
