import { useState, useEffect } from 'react'
import {
  MdAccountBalanceWallet, MdAdd, MdHistory, MdArrowUpward, MdArrowDownward,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import { walletAPI } from '../../api/wallet.js'
import { formatPrice } from '../../utils/helpers.js'
import { formatJalali } from '../../utils/jalali.js'
import Button from '../../components/common/Button/Button.jsx'
import { Input } from '../../components/common/Input/Input.jsx'
import Modal from '../../components/common/Modal/Modal.jsx'
import Loading from '../../components/common/Loading/Loading.jsx'
import './WalletPage.css'

const PRESET_AMOUNTS = [500000, 1000000, 2000000, 5000000]

export default function WalletPage() {
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [topupModal, setTopupModal] = useState(false)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      walletAPI.getMyWallet(),
      walletAPI.getTransactions(),
    ])
      .then(([w, tx]) => {
        setWallet(w)
        setTransactions(Array.isArray(tx) ? tx : (tx?.results || []))
      })
      .catch(() => toast.error('خطا در بارگذاری کیف پول'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleTopup() {
    const value = Number(amount)
    if (!value || value < 10000) {
      toast.error('حداقل مبلغ شارژ ۱۰,۰۰۰ تومان است')
      return
    }
    setSubmitting(true)
    try {
      const res = await walletAPI.requestTopup(value)
      if (res.payment_url) {
        window.location.href = res.payment_url
      } else {
        toast.error('خطا در اتصال به درگاه پرداخت')
        setSubmitting(false)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'خطا در ثبت درخواست شارژ')
      setSubmitting(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="wallet-page">
      <div className="page-header">
        <h1>کیف پول من</h1>
      </div>

      <div className="wallet-balance-card neu-card">
        <div className="wallet-balance-card__icon">
          <MdAccountBalanceWallet size={36} color="var(--primary)" />
        </div>
        <div className="wallet-balance-card__body">
          <span className="wallet-balance-card__label">موجودی فعلی</span>
          <span className="wallet-balance-card__value">{formatPrice(wallet?.balance || 0)}</span>
        </div>
        <Button onClick={() => { setAmount(''); setTopupModal(true) }}>
          <MdAdd size={18} /> شارژ کیف‌پول
        </Button>
      </div>

      <div className="wallet-history">
        <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MdHistory color="var(--primary)" /> تاریخچه تراکنش‌ها
        </h2>

        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="icon">💳</div>
            <h3>هنوز تراکنشی ثبت نشده</h3>
            <p>کیف‌پول خود را شارژ کنید تا بتوانید از آن برای پرداخت سفارش استفاده کنید</p>
          </div>
        ) : (
          <div className="wallet-tx-list">
            {transactions.map((tx) => {
              const positive = tx.amount > 0
              return (
                <div key={tx.id} className="wallet-tx-item neu-card-sm">
                  <div className={`wallet-tx-item__icon ${positive ? 'wallet-tx-item__icon--in' : 'wallet-tx-item__icon--out'}`}>
                    {positive ? <MdArrowDownward size={16} /> : <MdArrowUpward size={16} />}
                  </div>
                  <div className="wallet-tx-item__body">
                    <span className="wallet-tx-item__title">{tx.type_display}</span>
                    {tx.description && <span className="wallet-tx-item__desc">{tx.description}</span>}
                    <span className="wallet-tx-item__date">{formatJalali(tx.created_at)}</span>
                  </div>
                  <div className="wallet-tx-item__amount-wrap">
                    <span className={`wallet-tx-item__amount ${positive ? 'wallet-tx-item__amount--in' : 'wallet-tx-item__amount--out'}`}>
                      {positive ? '+' : ''}{formatPrice(tx.amount)}
                    </span>
                    <span className="wallet-tx-item__balance">موجودی: {formatPrice(tx.balance_after)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={topupModal}
        onClose={() => !submitting && setTopupModal(false)}
        title="شارژ کیف‌پول"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTopupModal(false)} disabled={submitting}>انصراف</Button>
            <Button onClick={handleTopup} loading={submitting}>پرداخت و شارژ</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="wallet-preset-grid">
            {PRESET_AMOUNTS.map((p) => (
              <button
                key={p}
                type="button"
                className={`wallet-preset-btn ${Number(amount) === p ? 'wallet-preset-btn--active' : ''}`}
                onClick={() => setAmount(String(p))}
              >
                {formatPrice(p)}
              </button>
            ))}
          </div>
          <Input
            label="مبلغ دلخواه (تومان)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="حداقل 10,000 تومان"
            dir="ltr"
          />
        </div>
      </Modal>
    </div>
  )
}
