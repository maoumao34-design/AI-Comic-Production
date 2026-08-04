import type { StepVersion } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'

interface Segment {
  seg_id?: string
  duration_s?: number
  keyframe_refs?: { first?: string; last?: string }
  prompt?: { shot?: string; action?: string; dialogue?: string; emotion?: string; sfx?: string } | string
  selection?: { decision?: string; reason?: string; consistency_check?: unknown }
}

interface Clips05Content {
  segments?: Segment[]
  provider?: string
  note?: string
  pending_schema?: boolean
}

/** 05 分段视频 + 镜头筛选 */
export function Clips05View({ version }: { version: StepVersion }) {
  const c = (version.content ?? {}) as Clips05Content
  const segs = c.segments ?? []

  return (
    <div className="step-clips">
      {c.note && <p className="muted">{c.note}</p>}
      {c.provider && (
        <div className="docmeta">
          <div><span className="k">provider</span><span className="v">{c.provider}</span></div>
        </div>
      )}

      <h4>分段视频</h4>
      {segs.length === 0 ? (
        <div className="empty">尚无 segments · 见下方产物；多平台候选请在上方槽位讨论后再 regenerate</div>
      ) : (
        <div className="beats">
          {segs.map((s, i) => (
            <div key={s.seg_id ?? i} className="beat">
              <div className="beat-head">
                <span className="bid">{s.seg_id ?? `seg${i + 1}`}</span>
                {s.duration_s != null && <span className="chip">{s.duration_s}s</span>}
                {s.selection?.decision && (
                  <span className={`chip ${s.selection.decision === 'adopt' ? '' : 'warn'}`}>{s.selection.decision}</span>
                )}
              </div>
              {typeof s.prompt === 'string' ? (
                <p className="narration">{s.prompt}</p>
              ) : s.prompt ? (
                <div className="kv">
                  {Object.entries(s.prompt).map(([k, v]) =>
                    v ? <div key={k}><span className="k">{k}</span><span className="v">{String(v)}</span></div> : null,
                  )}
                </div>
              ) : null}
              {s.keyframe_refs && (
                <div className="mono">kf: {s.keyframe_refs.first ?? '?'} → {s.keyframe_refs.last ?? '?'}</div>
              )}
              {s.selection?.reason && <div className="hint">{s.selection.reason}</div>}
            </div>
          ))}
        </div>
      )}

      <h4>产物预览</h4>
      <ArtifactGallery artifacts={version.artifacts} />

      <h4>参数</h4>
      <div className="kv">
        <div><span className="k">model</span><span className="v">{version.model ?? '—'}</span></div>
        <div><span className="k">seed</span><span className="v">{version.seed ?? '—'}</span></div>
        <div><span className="k">归档</span><span className="v mono">{version.archive_path}</span></div>
      </div>
    </div>
  )
}
