import { useState } from 'react'
import { MdInstallMobile, MdIosShare, MdAddBox, MdCheckCircle, MdMoreVert } from 'react-icons/md'
import Modal from '../Modal/Modal.jsx'
import Button from '../Button/Button.jsx'
import useInstallPrompt from '../../../hooks/useInstallPrompt.js'
import './InstallAppButton.css'

export default function InstallAppButton({ className = '', iconSize = 20, showLabel = true, label = 'نصب اپلیکیشن', title }) {
  const { platform, installed, canPromptNative, promptInstall } = useInstallPrompt()
  const [modalOpen, setModalOpen] = useState(false)

  if (installed) return null

  async function handleNativeInstall() {
    const accepted = await promptInstall()
    if (accepted) setModalOpen(false)
  }

  return (
    <>
      <button className={className} onClick={() => setModalOpen(true)} title={title}>
        <MdInstallMobile size={iconSize} />
        {showLabel && <span>{label}</span>}
      </button>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="نصب اپلیکیشن روی گوشی" size="full">
        {platform === 'ios' ? (
          <div className="install-guide">
            <p className="install-guide__intro">برای نصب روی آیفون/آیپد، این مراحل رو در Safari انجام بدید (نه Chrome):</p>
            <ol className="install-guide__steps">
              <li><MdIosShare size={20} /> روی دکمه‌ی Share (پایین صفحه) بزنید</li>
              <li><MdAddBox size={20} /> گزینه‌ی «Add to Home Screen» رو پیدا و انتخاب کنید</li>
              <li><MdCheckCircle size={20} /> روی «Add» بزنید</li>
            </ol>
          </div>
        ) : canPromptNative ? (
          <div className="install-guide">
            <p className="install-guide__intro">با زدن دکمه‌ی زیر، مرورگر خودش اپ رو نصب می‌کنه — دقیقاً مثل یک اپلیکیشن جدا روی گوشی/کامپیوترتون میاد.</p>
            <Button fullWidth onClick={handleNativeInstall}>
              <MdInstallMobile size={18} /> نصب کن
            </Button>
          </div>
        ) : (
          <div className="install-guide">
            <p className="install-guide__intro">برای نصب، این مراحل رو انجام بدید:</p>
            <ol className="install-guide__steps">
              <li><MdMoreVert size={20} /> روی منوی مرورگر (سه‌نقطه، بالا یا کنار نوار آدرس) بزنید</li>
              <li><MdAddBox size={20} /> گزینه‌ی «نصب اپلیکیشن» یا «Add to Home Screen» رو انتخاب کنید</li>
            </ol>
          </div>
        )}
      </Modal>
    </>
  )
}
