import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import toast from 'react-hot-toast'

export function getCartKey(itemId, variantId, addonIds = []) {
  const base = variantId ? `${itemId}_v${variantId}` : String(itemId)
  if (!addonIds.length) return base
  const sorted = [...addonIds].sort((a, b) => a - b)
  return `${base}_a${sorted.join('-')}`
}

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      discountCode: '',
      discountAmount: 0,
      deliveryType: 'takeaway',
      tableId: null,

      addItem: (menuItem, variant = null, selectedAddons = []) => {
        const items = get().items
        const addonIds = selectedAddons.map((a) => a.id)
        const cartKey = getCartKey(menuItem.id, variant?.id, addonIds)
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
                addons: selectedAddons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
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
        set({ items: [], discountCode: '', discountAmount: 0, tableId: null })
      },

      setDiscountCode: (code) => set({ discountCode: code }),
      setDiscountAmount: (amount) => set({ discountAmount: amount }),
      setDeliveryType: (type) => set({ deliveryType: type, tableId: null }),
      setTable: (id) => set({ tableId: id }),
    }),
    {
      name: 'cafe-cart',
      partialize: (state) => ({ items: state.items, deliveryType: state.deliveryType, tableId: state.tableId }),
    }
  )
)

export default useCartStore
