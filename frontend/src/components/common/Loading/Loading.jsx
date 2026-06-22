import './Loading.css'

export default function Loading({ size = 'md', text = 'در حال بارگذاری...', overlay = false }) {
  const content = (
    <div className="loading-container">
      <div className={`loading-spinner loading-spinner--${size}`} />
      {text && <p className="loading-text">{text}</p>}
    </div>
  )

  if (overlay) {
    return <div className="loading-overlay">{content}</div>
  }

  return content
}
