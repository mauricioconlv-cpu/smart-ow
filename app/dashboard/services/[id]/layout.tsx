import ServiceTabBar from './components/ServiceTabBar'

// Server component — Next.js 15 requires params as Promise
export default async function ServiceDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 6rem)',
      background: '#f1f5f9', borderRadius: 12,
      overflow: 'hidden', border: '1px solid #e2e8f0',
    }}>
      <ServiceTabBar id={id} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
