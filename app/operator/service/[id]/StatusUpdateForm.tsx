'use client'

import { useTransition } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { advanceServiceStatus } from './actions'

interface Props {
  serviceId: string;
  nextStatus: string;
  buttonLabel: string;
}

export default function StatusUpdateForm({ serviceId, nextStatus, buttonLabel }: Props) {
  const [isPending, startTransition] = useTransition()

  const handleUpdate = () => {
    startTransition(async () => {
       await advanceServiceStatus(serviceId, nextStatus)
    })
  }

  return (
    <button
      onClick={handleUpdate}
      disabled={isPending}
      className={`relative w-full overflow-hidden flex items-center justify-between rounded-xl px-5 py-4 text-white shadow-lg transition-all 
        ${isPending ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98]'}`}
    >
       <span className="font-bold text-lg">{buttonLabel}</span>
       {isPending ? (
         <Loader2 className="h-6 w-6 animate-spin" />
       ) : (
         <ChevronRight className="h-6 w-6" />
       )}
    </button>
  )
}
