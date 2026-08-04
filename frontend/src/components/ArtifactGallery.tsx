import type { Artifact } from '../types'

/** 通用产物预览：图/视频/音频真预览；文本显示路径 */
export function ArtifactGallery({ artifacts }: { artifacts: Artifact[] }) {
  if (!artifacts.length) {
    return <div className="empty">暂无产物</div>
  }
  return (
    <div className="artifacts">
      {artifacts.map((a, i) => (
        <div key={i} className={`artifact ${a.type}`}>
          {a.type === 'image' && looksLikeUrl(a.url) ? (
            <img src={a.url} alt={a.label} className="art-media" loading="lazy" />
          ) : a.type === 'video' && looksLikeUrl(a.url) ? (
            <video src={a.url} className="art-media" controls preload="metadata" />
          ) : a.type === 'audio' && looksLikeUrl(a.url) ? (
            <audio src={a.url} controls preload="metadata" className="art-audio" />
          ) : (
            <div className="ph">{a.type === 'image' ? '🖼️' : a.type === 'video' ? '🎬' : a.type === 'audio' ? '🔊' : '📄'}</div>
          )}
          <div className="lbl">{a.label}</div>
          <div className="url mono">{a.url}</div>
        </div>
      ))}
    </div>
  )
}

function looksLikeUrl(u: string): boolean {
  return /^https?:\/\//i.test(u) || u.startsWith('/') || u.startsWith('data:')
}
