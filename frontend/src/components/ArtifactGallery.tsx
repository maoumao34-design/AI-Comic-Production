import { useState } from 'react'
import type { Artifact } from '../types'
import { MediaLightbox } from './MediaLightbox'

/** 通用产物预览：图/视频/音频真预览；文本显示路径；图/视频可点击放大 */
export function ArtifactGallery({ artifacts }: { artifacts: Artifact[] }) {
  const [lb, setLb] = useState<{ src: string; alt: string; kind: 'image' | 'video' } | null>(null)

  if (!artifacts.length) {
    return <div className="empty">暂无产物</div>
  }
  return (
    <>
      <div className="artifacts">
        {artifacts.map((a, i) => {
          const urlOk = looksLikeUrl(a.url)
          const canZoom = urlOk && (a.type === 'image' || a.type === 'video')
          return (
            <div key={i} className={`artifact ${a.type}`}>
              {a.type === 'image' && urlOk ? (
                <button
                  type="button"
                  className="art-zoom"
                  onClick={() => setLb({ src: a.url, alt: a.label, kind: 'image' })}
                  title="点击放大"
                >
                  <img src={a.url} alt={a.label} className="art-media" loading="lazy" />
                </button>
              ) : a.type === 'video' && urlOk ? (
                <button
                  type="button"
                  className="art-zoom"
                  onClick={() => setLb({ src: a.url, alt: a.label, kind: 'video' })}
                  title="点击放大"
                >
                  <video src={a.url} className="art-media" preload="metadata" muted />
                </button>
              ) : a.type === 'audio' && urlOk ? (
                <audio src={a.url} controls preload="metadata" className="art-audio" />
              ) : (
                <div className="ph">
                  {a.type === 'image' ? '🖼️' : a.type === 'video' ? '🎬' : a.type === 'audio' ? '🔊' : '📄'}
                </div>
              )}
              <div className="lbl">
                {a.label}
                {canZoom ? <span className="zoom-hint"> · 点击放大</span> : null}
              </div>
              <div className="url mono">{a.url}</div>
            </div>
          )
        })}
      </div>
      {lb && (
        <MediaLightbox src={lb.src} alt={lb.alt} kind={lb.kind} onClose={() => setLb(null)} />
      )}
    </>
  )
}

function looksLikeUrl(u: string): boolean {
  return /^https?:\/\//i.test(u) || u.startsWith('/') || u.startsWith('data:')
}
