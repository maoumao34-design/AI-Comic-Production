import type { StepVersion } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'

/** 05 分段视频 + 筛镜头（对齐 STEP-CONTENT-SCHEMA-03-04-05） */
interface Segment {
  seg_id?: string
  duration_s?: number
  keyframe_refs?: { first?: string; last?: string }
  prompt?: { shot?: string; action?: string; dialogue?: string; emotion?: string; sfx?: string } | string
  selection?: {
    decision?: 'adopt' | 'reject' | 'pending' | string
    reason?: string
    consistency_check?: { passed?: boolean; issues?: string[] }
  }
  output?: { url: string; type: 'video'; thumbnail?: string }
}

interface Segments05Content {
  segments?: Segment[]
  /** 旧 FE mock 字段；新 schema 用上方 PlatformSlotPanel + params_override.provider */
  provider?: string
  note?: string
  pending_schema?: boolean
}

/** 05 分段视频审片。平台槽位（discuss-first）由 PlatformSlotPanel 统一渲染。 */
export function Segments05View({ version }: { version: StepVersion }) {
  const c = (version.content ?? {}) as Segments05Content
  const segs = c.segments ?? []
  const adopted = segs.filter((s) => s.selection?.decision === 'adopt').length
  const rejected = segs.filter((s) => s.selection?.decision === 'reject').length

  return (
    <div className="step-seg05">
      {c.pending_schema && (
        <div className="callout info">05 schema 占位中；下方含筛镜头记录壳。</div>
      )}
      {c.note && <p className="muted">{c.note}</p>}
      {c.provider && (
        <div className="docmeta">
          <div><span className="k">provider</span><span className="v">{c.provider}</span></div>
        </div>
      )}

      <div className="docmeta">
        <div className="row">
          <span><b>segments</b> {segs.length}</span>
          <span>采用 {adopted}</span>
          <span>淘汰 {rejected}</span>
          <span className="mono">{version.archive_path}</span>
        </div>
      </div>

      <h4>分段视频</h4>
      {segs.length === 0 ? (
        <div className="empty">尚无 segments · 见下方产物；多平台候选请在上方槽位讨论后再 regenerate</div>
      ) : (
        <div className="seg-list">
          {segs.map((seg, i) => {
            const sel = seg.selection?.decision ?? 'pending'
            return (
              <article key={seg.seg_id ?? i} className={`seg-card sel-${sel}`}>
                <header>
                  <b>{seg.seg_id ?? `seg${i + 1}`}</b>
                  {seg.duration_s != null && <span className="chip">{seg.duration_s}s</span>}
                  <span className={`st st-${sel === 'adopt' ? 'approved' : sel === 'reject' ? 'failed' : 'awaiting_review'}`}>
                    {sel === 'adopt' ? '采用' : sel === 'reject' ? '淘汰' : '待筛'}
                  </span>
                </header>
                <div className="view-cell wide">
                  <div className="ph">🎬</div>
                  <div className="url mono">{seg.output?.url ?? '（未出片 · 见产物预览）'}</div>
                </div>
                <div className="kv">
                  {seg.keyframe_refs && (
                    <div>
                      <span className="k">首尾帧</span>
                      <span className="v mono">
                        {[seg.keyframe_refs.first, seg.keyframe_refs.last].filter(Boolean).join(' → ') || '—'}
                      </span>
                    </div>
                  )}
                  {typeof seg.prompt === 'string' ? (
                    <div><span className="k">prompt</span><span className="v">{seg.prompt}</span></div>
                  ) : seg.prompt ? (
                    <>
                      {seg.prompt.shot && <div><span className="k">镜头</span><span className="v">{seg.prompt.shot}</span></div>}
                      {seg.prompt.action && <div><span className="k">动作</span><span className="v">{seg.prompt.action}</span></div>}
                      {seg.prompt.dialogue && <div><span className="k">台词</span><span className="v">{seg.prompt.dialogue}</span></div>}
                      {seg.prompt.emotion && <div><span className="k">情绪</span><span className="v">{seg.prompt.emotion}</span></div>}
                      {seg.prompt.sfx && <div><span className="k">音效</span><span className="v">{seg.prompt.sfx}</span></div>}
                    </>
                  ) : null}
                  {seg.selection?.reason && (
                    <div><span className="k">筛选理由</span><span className="v">{seg.selection.reason}</span></div>
                  )}
                  {seg.selection?.consistency_check && (
                    <div>
                      <span className="k">一致性</span>
                      <span className={`v ${seg.selection.consistency_check.passed ? 'ok' : 'bad'}`}>
                        {seg.selection.consistency_check.passed
                          ? 'passed'
                          : (seg.selection.consistency_check.issues ?? []).join('; ')}
                      </span>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
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
