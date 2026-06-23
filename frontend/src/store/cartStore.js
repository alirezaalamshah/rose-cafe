import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import toast from 'react-hot-toast'

function getCartKey(itemId, variantId) {
  return variantId ? `${itemId}_v${variantId}` : String(itemId)
}

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      discountCode: '',
      discountAmount: 0,
      deliveryType: 'takeaway',

      addItem: (menuItem, variant = null) => {
        const items = get().items
        const cartKey = getCartKey(menuItem.id, variant?.id)
        const existing = items.find((i) => (i.cartKey || String(i.id)) === cartKey)

        if (existing) {
          set({
            items: items.map((i) =>
              (i.cartKey || String(i.id)) === cartKey ? { ...i, quantity: i.quantity + 1 } : i
            ),
          })
        } else {
          set({
            items: [
              ...items,
              {
                ...menuItem,
                cartKey,
                variantId: variant?.id || null,
                variantName: variant?.name || null,
                price: variant ? variant.price : menuItem.price,
                discounted_price: variant
                  ? (variant.discounted_price || null)
                  : menuItem.discounted_price,
                quantity: 1,
              },
            ],
          })
        }
        const label = variant ? `${menuItem.name} (${variant.name})` : menuItem.name
        toast.success(`${label} به سبد اضافه شد`)
      },

      removeItem: (cartKey) => {
        set({ items: get().items.filter((i) => (i.cartKey || String(i.id)) !== cartKey) })
      },

      updateQuantity: (cartKey, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartKey)
          return
        }
        set({
          items: get().items.map((i) =>
            (i.cartKey || String(i.id)) === cartKey ? { ...i, quantity } : i
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
