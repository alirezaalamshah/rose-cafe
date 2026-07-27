import useConfirmStore from '../../../store/confirmStore.js'
import Modal from '../Modal/Modal.jsx'
import Button from '../Button/Button.jsx'

/**
 * یک‌بار در سطح App مونت می‌شود؛ بقیه‌ی اپ فقط با فراخوانی confirm(message)
 * از store/confirmStore.js از هرجایی می‌توانند یک مودال تایید نشان بدهند.
 */
export default function ConfirmDialog() {
  const { isOpen, message, title, confirmLabel, cancelLabel, danger, handle } = useConfirmStore()

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => handle(false)}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => handle(false)}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => handle(true)}>{confirmLabel}</Button>
        </>
      }
    >
      <p style={{ margin: 0, lineHeight: 1.8 }}>{message}</p>
    </Modal>
  )
}
