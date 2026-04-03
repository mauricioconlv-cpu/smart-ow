import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Save, ArrowLeft, Truck, Zap, Stethoscope, Wrench } from 'lucide-react'

function CurrencyInput({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  return (
    <div className="relative rounded-md shadow-sm">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <span className="text-slate-400 text-sm">$</span>
      </div>
      <input
        type="number" name={name} id={name} step="0.01" defaultValue={defaultValue}
        className="block w-full rounded-md border-0 py-2 pl-7 pr-3 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600 text-sm bg-white shadow-sm"
      />
    </div>
  )
}

export default function NewClientPage() {

  async function createClientAction(formData: FormData) {
    'use server'
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return

    const companyId  = profile.company_id
    const clientName = formData.get('name') as string

    // 1. Crear el cliente
    const res = await supabase
      .from('clients')
      .insert({ name: clientName, company_id: companyId })
      .select('id')
      .single()

    const newClient = res.data as { id: string } | null
    if (res.error || !newClient) {
      console.error('Error creando cliente:', res.error?.message)
      return
    }

    // 2. Construir costos — Grúas + Auxilios Viales + Servicios Médicos
    const costs: Record<string, number> = {}

    // Actualizar datos de perfil del cliente
    await supabase.from('clients').update({
      email:             (formData.get('email')             as string)?.trim() || null,
      coordinator_name:  (formData.get('coordinator_name')  as string)?.trim() || null,
      coordinator_phone: (formData.get('coordinator_phone') as string)?.trim() || null,
      cabina_telefono:   (formData.get('cabina_telefono')   as string)?.trim() || null,
    }).eq('id', newClient.id)

    for (const t of ['a', 'b', 'c', 'd', 'paso_corriente', 'cambio_llanta', 'gasolina', 'medico_domicilio', 'reparto_medicamento', 'telemedicina']) {
      costs[`costo_local_tipo_${t}`] = parseFloat(formData.get(`costo_local_tipo_${t}`) as string) || 0
      costs[`costo_bande_tipo_${t}`] = parseFloat(formData.get(`costo_bande_tipo_${t}`) as string) || 0
      costs[`costo_km_tipo_${t}`]    = parseFloat(formData.get(`costo_km_tipo_${t}`)    as string) || 0
    }

    // Costos adicionales
    for (const field of [
      'costo_maniobra', 'costo_hora_espera', 'costo_abanderamiento', 'costo_resguardo',
      'costo_dollys', 'costo_patines', 'costo_go_jacks',
      'costo_pistola_impacto', 'costo_dardos', 'costo_bidon',
      'costo_rescate_subterraneo', 'costo_adaptacion',
      'costo_blindaje_1', 'costo_blindaje_2', 'costo_blindaje_3', 'costo_blindaje_4',
      'costo_blindaje_5', 'costo_blindaje_6', 'costo_blindaje_7', 'costo_kg_carga'
    ]) {
      costs[field] = parseFloat(formData.get(field) as string) || 0
    }

    // 3. Insertar fila base
    const { error: insertErr } = await supabase.from('pricing_rules').insert({
      client_id:  newClient.id,
      company_id: companyId,
      tipo:       'general',
      costo_base: 0,
      costo_km:   0,
    })

    if (!insertErr) {
      // 4. UPDATE con todas las columnas nuevas
      await supabase.from('pricing_rules').update(costs).eq('client_id', newClient.id)
    } else {
      console.error('Error INSERT pricing_rule:', insertErr.message)
    }

    redirect('/dashboard/clients')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
        <Link href="/dashboard/clients" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Registrar Nueva Aseguradora</h2>
          <p className="mt-1 text-sm text-gray-500">Define los tabuladores de cobro que el sistema usará para cotizar servicios.</p>
        </div>
      </div>

      <form action={createClientAction} className="space-y-6">

        {/* Información General */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">
                Nombre de la Aseguradora o Cliente *
              </label>
              <input type="text" name="name" id="name" required
                className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm shadow-sm bg-white"
                placeholder="Ej. Seguros AXA" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1">Correo Electrónico</label>
              <input type="email" name="email" id="email"
                className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm shadow-sm bg-white"
                placeholder="contacto@aseguradora.com" />
            </div>
            <div>
              <label htmlFor="cabina_telefono" className="block text-sm font-medium text-gray-900 mb-1">Teléfono Cabina de Seguimiento</label>
              <input type="tel" name="cabina_telefono" id="cabina_telefono"
                className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm shadow-sm bg-white"
                placeholder="55XXXXXXXX" />
            </div>
            <div>
              <label htmlFor="coordinator_name" className="block text-sm font-medium text-gray-900 mb-1">Nombre del Coordinador</label>
              <input type="text" name="coordinator_name" id="coordinator_name"
                className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm shadow-sm bg-white"
                placeholder="Ej. Lic. Roberto Sánchez" />
            </div>
            <div>
              <label htmlFor="coordinator_phone" className="block text-sm font-medium text-gray-900 mb-1">Contacto del Coordinador</label>
              <input type="tel" name="coordinator_phone" id="coordinator_phone"
                className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm shadow-sm bg-white"
                placeholder="55XXXXXXXX" />
            </div>
          </div>
        </div>

        {/* ── Sección 1: Grúas / Arrastre ──────────────────── */}
        <div className="bg-white shadow rounded-lg p-6 border-l-4 border-blue-400">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" /> Grúas / Arrastre
          </h3>
          <p className="text-xs text-slate-500 mb-4">Costo local, banderazo y precio por kilómetro según el tipo de grúa.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left pb-3 pr-6 text-xs font-bold text-slate-500 uppercase w-32">Tipo</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Costo Local</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Banderazo</th>
                  <th className="text-left pb-3 text-xs font-bold text-slate-500 uppercase">$/Km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {([
                  { key: 'a', label: 'Tipo A', desc: '< 3.5 ton',   color: 'text-green-700 bg-green-100' },
                  { key: 'b', label: 'Tipo B', desc: '3.5–7.5 ton', color: 'text-blue-700 bg-blue-100' },
                  { key: 'c', label: 'Tipo C', desc: '7.5–11 ton',  color: 'text-orange-700 bg-orange-100' },
                  { key: 'd', label: 'Tipo D', desc: '> 11 ton',    color: 'text-red-700 bg-red-100' },
                ] as const).map(({ key, label, desc, color }) => (
                  <tr key={key}>
                    <td className="py-4 pr-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black text-sm ${color}`}>{label}</span>
                      <span className="block text-xs text-slate-400 mt-1">{desc}</span>
                    </td>
                    <td className="py-4 pr-4"><CurrencyInput name={`costo_local_tipo_${key}`} /></td>
                    <td className="py-4 pr-4"><CurrencyInput name={`costo_bande_tipo_${key}`} /></td>
                    <td className="py-4"><CurrencyInput name={`costo_km_tipo_${key}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Sección 2: Auxilios Viales ──────────────────── */}
        <div className="bg-white shadow rounded-lg p-6 border-l-4 border-yellow-400">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" /> Auxilios Viales
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Tarifa por servicio de asistencia vial. El banderazo y $/km aplican solo si el servicio es foráneo.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left pb-3 pr-6 text-xs font-bold text-slate-500 uppercase w-40">Servicio</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Tarifa Fija / Local</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Banderazo (foráneo)</th>
                  <th className="text-left pb-3 text-xs font-bold text-slate-500 uppercase">$/Km (foráneo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {([
                  { key: 'cambio_llanta',  label: 'Cambio de Llanta',       desc: 'Auxilio vial', color: 'text-slate-700 bg-slate-200' },
                  { key: 'paso_corriente', label: 'Paso de Corriente',      desc: 'Auxilio vial', color: 'text-yellow-700 bg-yellow-100' },
                  { key: 'gasolina',       label: 'Suministro de Gasolina',  desc: 'Auxilio vial', color: 'text-purple-700 bg-purple-100' },
                ] as const).map(({ key, label, desc, color }) => (
                  <tr key={key}>
                    <td className="py-4 pr-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black text-sm ${color}`}>{label}</span>
                      <span className="block text-xs text-slate-400 mt-1">{desc}</span>
                    </td>
                    <td className="py-4 pr-4"><CurrencyInput name={`costo_local_tipo_${key}`} /></td>
                    <td className="py-4 pr-4"><CurrencyInput name={`costo_bande_tipo_${key}`} /></td>
                    <td className="py-4"><CurrencyInput name={`costo_km_tipo_${key}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Sección 3: Servicios Médicos ─────────────────── */}
        <div className="bg-white shadow rounded-lg p-6 border-l-4 border-emerald-400">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-emerald-500" /> Servicios Médicos
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Tarifa negociada para cada tipo de servicio médico cubierto. El banderazo y $/km aplican solo si el servicio requiere traslado foráneo o kilometraje extra.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left pb-3 pr-6 text-xs font-bold text-slate-500 uppercase w-48">Servicio Médico</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Tarifa Local / Base</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Banderazo (Foráneo)</th>
                  <th className="text-left pb-3 text-xs font-bold text-slate-500 uppercase">$/Km (Foráneo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {([
                  { key: 'medico_domicilio',    label: '🩺 Médico Domicilio',    desc: 'Consulta presencial', color: 'text-emerald-700 bg-emerald-100' },
                  { key: 'reparto_medicamento', label: '📦 Reparto Medicamento', desc: 'Entrega a domicilio', color: 'text-teal-700 bg-teal-100' },
                  { key: 'telemedicina',        label: '📹 Telemedicina',        desc: 'Consulta en línea',   color: 'text-cyan-700 bg-cyan-100' },
                ] as const).map(({ key, label, desc, color }) => (
                  <tr key={key}>
                    <td className="py-4 pr-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black text-sm ${color}`}>{label}</span>
                      <span className="block text-xs text-slate-400 mt-1 pl-1">{desc}</span>
                    </td>
                    <td className="py-4 pr-4"><CurrencyInput name={`costo_local_tipo_${key}`} /></td>
                    <td className="py-4 pr-4"><CurrencyInput name={`costo_bande_tipo_${key}`} /></td>
                    <td className="py-4"><CurrencyInput name={`costo_km_tipo_${key}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Sección 4: Costos Adicionales ───────────────── */}
        <div className="bg-white shadow rounded-lg p-6 border-l-4 border-orange-400">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-500" /> Costos de Operación y Herramientas
          </h3>
          <p className="text-xs text-slate-500 mb-4">Costos extras que se suman al servicio según lo utilizado.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {[
              { name: 'costo_maniobra',           label: 'Maniobra' },
              { name: 'costo_hora_espera',         label: 'Hora de Espera' },
              { name: 'costo_abanderamiento',      label: 'Abanderamiento' },
              { name: 'costo_resguardo',           label: 'Resguardo' },
              { name: 'costo_dollys',              label: 'Dollys' },
              { name: 'costo_patines',             label: 'Patines' },
              { name: 'costo_go_jacks',            label: 'Go Jacks' },
              { name: 'costo_pistola_impacto',     label: 'Pistola de Impacto' },
              { name: 'costo_dardos',              label: 'Dardos / Punteros' },
              { name: 'costo_bidon',               label: 'Bidón p/Gasolina' },
              { name: 'costo_rescate_subterraneo', label: 'Rescate Sub.' },
              { name: 'costo_adaptacion',          label: 'Adaptación' },
              { name: 'costo_kg_carga',            label: 'Kg de Carga' },
            ].map(({ name, label }) => (
              <div key={name}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <CurrencyInput name={name} />
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Blindaje por Nivel</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[1,2,3,4,5,6,7].map(n => (
                <div key={n}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nivel {n}</label>
                  <CurrencyInput name={`costo_blindaje_${n}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pb-8">
          <Link href="/dashboard/clients"
            className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors">
            Cancelar
          </Link>
          <button type="submit"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors">
            <Save className="h-5 w-5" />
            Guardar Aseguradora
          </button>
        </div>
      </form>
    </div>
  )
}
