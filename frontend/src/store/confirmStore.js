import { create } from 'zustand'

/**
 * جایگزین حرفه‌ای‌تر برای window.confirm() مرورگر — همان API ساده‌ی
 * «await confirm(پیام)» را می‌دهد ولی با مودال هماهنگ با طراحی اپ.
 */
const useConfirmStore = create((set, get) => ({
  isOpen: false,
  message: '',
  title: '',
  confirmLabel: 'تایید',
  cancelLabel: 'انصراف',
  danger: true,
  _resolve: null,

  request: (message, options = {}) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        message,
        title: options.title || 'تایید عملیات',
        confirmLabel: options.confirmLabel || 'تایید',
        cancelLabel: options.cancelLabel || 'انصراف',
        danger: options.danger !== false,
        _resolve: resolve,
      })
    })
  },

  handle: (result) => {
    get()._resolve?.(result)
    set({ isOpen: false, _resolve: null })
  },
}))

export function confirm(message, options) {
  return useConfirmStore.getState().request(message, options)
}

export default useConfirmStore
