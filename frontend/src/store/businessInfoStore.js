import { create } from 'zustand'
import { businessAPI } from '../api/business.js'

// اطلاعات کافه (نام/شعار/تلفن/آدرس) تقریباً هیچ‌وقت در طول یک session تغییر نمی‌کند
// ولی هم Header و هم Footer به آن نیاز دارند — این استور مانع دو بار فراخوانی همان endpoint می‌شود
const useBusinessInfoStore = create((set, get) => ({
  cafeInfo: null,
  loaded: false,
  loading: false,

  fetchCafeInfo: () => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    businessAPI.getCafeInfo()
      .then((data) => set({ cafeInfo: data, loaded: true, loading: false }))
      .catch(() => set({ loading: false }))
  },
}))

export default useBusinessInfoStore
