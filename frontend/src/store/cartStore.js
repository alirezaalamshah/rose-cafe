import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import toast from 'react-hot-toast'

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      discountCode: '',
      discountAmount: 0,
      deliveryType: 'takeaway',

      addItem: (menuItem) => {
        const items = get().items
        const existing = items.find((i) => i.id === menuItem.id)
        if (existing) {
          set({
            items: items.map((i) =>
              i.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          })
        } else {
          set({ items: [...items, { ...menuItem, quantity: 1 }] })
        }
        toast.success(`${menuItem.name} به سبد اضافه شد`)
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) })
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id)
          return
        }
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, quantity } : i
          ),
        })
      },

      clearCart: () => {
        set({ items: [], discountCode: '', discountAmount: 0 })
      },

      setDiscountCode: (code) => set({ discountCode: code }),
      setDiscountAmount: (amount) => set({ discountAmount: amount }),
      setDeliveryType: (type) => set({ deliveryType: type }),

      get totalItems() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },

      get subtotal() {
        return get().items.reduce(
          (sum, i) => sum + (i.discounted_price || i.price) * i.quantity,
          0
        )
      },

      get deliveryCost() {
        return get().deliveryType === 'delivery' ? 15000 : 0
      },

      get total() {
        return get().subtotal + get().deliveryCost - get().discountAmount
      },
    }),
    {
      name: 'cafe-cart',
      partialize: (state) => ({ items: state.items, deliveryType: state.deliveryType }),
    }
  )
)

export default useCartStore
