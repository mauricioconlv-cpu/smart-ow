import OperatorClientLayer from './components/OperatorClientLayer'

export const dynamic = 'force-dynamic'

export default async function OperatorPage() {
  // All data fetching, auth checks, and rendering happens
  // in the client component to avoid SSR/hydration crashes
  return <OperatorClientLayer />
}
