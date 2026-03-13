import { create } from 'zustand'

interface OperatorState {
  activeServiceId: string | null
  setActiveService: (id: string | null) => void
}

export const useOperatorStore = create<OperatorState>((set) => ({
  activeServiceId: null,
  setActiveService: (id) => set({ activeServiceId: id }),
}))
