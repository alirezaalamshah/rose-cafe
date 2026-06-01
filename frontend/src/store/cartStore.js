import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      deliveryType: 'takeaway',
      addressId: null,
      discountCode: '',
      discountAmount: 0,
      note: '',

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
      },

      removeItem: (id) =>
        set({ items: get().items.filter((i) => i.id !== id) }),

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

      clearCart: () =>
        set({
          items: [],
          discountCode: '',
          discountAmount: 0,
          note: '',
        }),

      setDeliveryType: (type) => set({ deliveryType: type }),
      setAddressId: (id) => set({ addressId: id }),
      setDiscountCode: (code) => set({ discountCode: code }),
      setDiscountAmount: (amount) => set({ discountAmount: amount }),
      setNote: (note) => set({ note }),

      getTotalPrice: () =>
        get().items.reduce((sum, i) => sum + i.final_price * i.quantity, 0),

      getTotalItems: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      getDeliveryCost: () =>
        get().deliveryType === 'delivery' ? 35000 : 0,

      getFinalPrice: () => {
        const total = get().getTotalPrice()
        const delivery = get().getDeliveryCost()
        const discount = get().discountAmount
        return total + delivery - discount
      },
    }),
    {
      name: 'cart-storage',
    }
  )
)

export default useCartStore