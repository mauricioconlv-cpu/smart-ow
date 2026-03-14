import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Save, ArrowLeft } from 'lucide-react'

export default function NewClientPage() {
  
  async function createClientAction(formData: FormData) {
    'use server'
    const supabase = await createClient()

    // 0. Obtener la empresa del usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return

    const companyId = profile.company_id
    const clientName = formData.get('name') as string

    // Tarifas Locales
    const localCost = parseFloat(formData.get('localCost') as string)

    // Tarifas Foráneas
    const foraneoBase = parseFloat(formData.get('foraneoBase') as string)
    const foraneoKm = parseFloat(formData.get('foraneoKm') as string)

    // 1. Insert Client con company_id obligatorio
    const res = await supabase
      .from('clients')
      .insert({ name: clientName, company_id: companyId })
      .select('id')
      .single()

    const newClient = res.data as { id: string } | null
    const clientErr = res.error

    if (clientErr || !newClient) {
      console.error('Error creando cliente:', clientErr?.message)
      return
    }

    // 2. Insert Pricing Rules con company_id obligatorio
    const { error: rulesErr } = await supabase.from('pricing_rules').insert([
      { client_id: newClient.id, company_id: companyId, tipo: 'local',   costo_base: localCost,  costo_km: 0 },
      { client_id: newClient.id, company_id: companyId, tipo: 'foraneo', costo_base: foraneoBase, costo_km: foraneoKm }
    ])

    if (rulesErr) {
      console.error('Error creando tarifas:', rulesErr.message)
    }

    redirect('/dashboard/clients')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
        <Link href="/dashboard/clients" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Registrar Nueva Aseguradora</h2>
          <p className="mt-1 text-sm text-gray-500">
            Define los tabuladores de cobro que el sistema usará para cotizar servicios.
          </p>
        </div>
      </div>

      <form action={createClientAction} className="bg-white shadow rounded-lg p-6 space-y-8">
        {/* Basic Info */}
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Información General</h3>
          <div>
            <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900">
              Nombre de la Aseguradora o Cliente
            </label>
            <div className="mt-2">
              <input
                type="text"
                name="name"
                id="name"
                required
                className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 shadow-sm"
                placeholder="Ej. Seguros AXA"
              />
            </div>
          </div>
        </section>

        {/* Pricing Rules */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-gray-100">
          
          {/* Tarifa Local */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-blue-800">Tarifa Local (Costo Fijo)</h3>
            <p className="text-xs text-gray-500">Aplica para arrastres dentro de la misma zona céntrica.</p>
            <div>
              <label htmlFor="localCost" className="block text-sm font-medium leading-6 text-gray-900">
                Costo Base (MXN)
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  name="localCost"
                  id="localCost"
                  step="0.01"
                  required
                  className="block w-full rounded-md border-0 py-2.5 pl-7 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 shadow-sm"
                  placeholder="800.00"
                />
              </div>
            </div>
          </div>

          {/* Tarifa Foránea */}
          <div className="space-y-4">
             <h3 className="text-lg font-medium text-purple-800">Tarifa Foránea (Por Kilometraje)</h3>
             <p className="text-xs text-gray-500">Aplica para cambios de localidad calculando distancia.</p>
             <div>
              <label htmlFor="foraneoBase" className="block text-sm font-medium leading-6 text-gray-900">
                Banderazo (MXN)
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  name="foraneoBase"
                  id="foraneoBase"
                  step="0.01"
                  required
                  className="block w-full rounded-md border-0 py-2.5 pl-7 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 sm:text-sm sm:leading-6 shadow-sm"
                  placeholder="500.00"
                />
              </div>
            </div>

            <div>
              <label htmlFor="foraneoKm" className="block text-sm font-medium leading-6 text-gray-900">
                Costo por Kilómetro Adicional (MXN)
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  name="foraneoKm"
                  id="foraneoKm"
                  step="0.01"
                  required
                  className="block w-full rounded-md border-0 py-2.5 pl-7 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 sm:text-sm sm:leading-6 shadow-sm"
                  placeholder="25.00"
                />
              </div>
            </div>
          </div>

        </section>

        <div className="pt-6 border-t border-gray-100 flex justify-end">
           <button
            type="submit"
            className="flex items-center space-x-2 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Save className="h-5 w-5" />
            <span>Guardar Aseguradora</span>
          </button>
        </div>
      </form>

    </div>
  )
}
