import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MdPhone, MdLocationOn, MdRestaurantMenu, MdTableBar, MdRateReview } from 'react-icons/md'
import {
  FaInstagram, FaTelegram, FaWhatsapp, FaXTwitter,
  FaLinkedin, FaYoutube, FaTiktok, FaGlobe,
} from 'react-icons/fa6'
import { businessAPI } from '../../../api/business.js'
import useBusinessInfoStore from '../../../store/businessInfoStore.js'
import './Footer.css'

const NAV_LINKS = [
  { to: '/', icon: <MdRestaurantMenu size={14} />, label: 'منو' },
  { to: '/reservations', icon: <MdTableBar size={14} />, label: 'رزرو میز' },
  { to: '/reviews', icon: <MdRateReview size={14} />, label: 'نظرات' },
]

const SOCIAL_ICONS = {
  instagram: FaInstagram,
  telegram: FaTelegram,
  whatsapp: FaWhatsapp,
  twitter: FaXTwitter,
  linkedin: FaLinkedin,
  youtube: FaYoutube,
  tiktok: FaTiktok,
  website: FaGlobe,
}

export default function Footer() {
  const info = useBusinessInfoStore((s) => s.cafeInfo)
  const fetchCafeInfo = useBusinessInfoStore((s) => s.fetchCafeInfo)
  const [socialLinks, setSocialLinks] = useState([])

  useEffect(() => {
    fetchCafeInfo()
    businessAPI.getSocialLinks()
      .then((data) => setSocialLinks(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => {})
  }, [fetchCafeInfo])

  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer__inner">

        {/* برند */}
        <div className="footer__brand">
          <img src="/ECUC9864.JPEG" alt={info?.name || 'کافه'} className="footer__logo" />
          <div>
            <span className="footer__name">{info?.name || 'کافه'}</span>
            {info?.tagline && <p className="footer__tagline">{info.tagline}</p>}
          </div>
        </div>

        {/* لینک‌ها */}
        <nav className="footer__nav">
          {NAV_LINKS.map(({ to, icon, label }) => (
            <Link key={to} to={to} className="footer__nav-link">
              {icon} {label}
            </Link>
          ))}
        </nav>

        {/* تماس */}
        <div className="footer__contact">
          {info?.phone && (
            <a href={`tel:${info.phone}`} className="footer__contact-item" dir="ltr">
              <MdPhone size={14} />
              {info.phone}
            </a>
          )}
          {socialLinks.map((link) => {
            const Icon = SOCIAL_ICONS[link.platform] || FaGlobe
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="footer__contact-item"
              >
                <Icon size={14} />
                {link.platform === 'website' ? link.account : `@${link.account.replace('@', '')}`}
              </a>
            )
          })}
          {info?.address && (
            <span className="footer__contact-item footer__address">
              <MdLocationOn size={14} />
              {info.address}
            </span>
          )}
        </div>

      </div>

      <div className="footer__bottom">
        <a
          referrerPolicy="origin"
          target="_blank"
          href="https://trustseal.enamad.ir/?id=6865601&Code=kQRGaZ8QprwBVpurbFfcGJzwKHWrbLzG"
          className="footer__enamad"
        >
          <img
            referrerPolicy="origin"
            src="https://trustseal.enamad.ir/logo.aspx?id=6865601&Code=kQRGaZ8QprwBVpurbFfcGJzwKHWrbLzG"
            alt="اینماد"
            style={{ cursor: 'pointer' }}
            code="kQRGaZ8QprwBVpurbFfcGJzwKHWrbLzG"
          />
        </a>
        <div className="footer__bottom-text">
          <span>© {year} {info?.name || 'کافه'}</span>
          <span className="footer__dot">·</span>
          <span>
            طراحی و توسعه:{' '}
            <a
              href="https://alirezaalamshah.ir/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer__credit-link"
            >
              علیرضا عالمشاه
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
