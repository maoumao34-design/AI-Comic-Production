import { useEffect } from 'react'

/** 全屏查看图/视频；Esc 或点遮罩关闭 */
export function MediaLightbox({
  src,
  alt,
  kind = 'image',
  onClose,
}: {
  src: string
  alt?: string
  kind?: 'image' | 'video'
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt || '预览'}
      onClick={onClose}
    >
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="关闭">
        ×
      </button>
      <div className="lightbox-body" onClick={(e) => e.stopPropagation()}>
        {kind === 'video' ? (
          <video src={src} className="lightbox-media" controls autoPlay />
        ) : (
          <img src={src} alt={alt || ''} className="lightbox-media" />
        )}
        {alt ? <div className="lightbox-caption">{alt}</div> : null}
      </div>
    </div>
  )
}
