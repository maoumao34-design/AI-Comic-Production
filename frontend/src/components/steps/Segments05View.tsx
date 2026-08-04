import type { StepVersion } from '../../types'

/** 05 分段视频 + 筛镜头（对齐 STEP-CONTENT-SCHEMA-03-04-05） */
interface Segment {
  seg_id: string
  duration_s: number
  keyframe_refs?: { first?: string; last?: string }
  prompt?: { shot?: string; action?: string; dialogue?: string; emotion?: string; sfx?: string }
  selection?: { decision: 'adopt' | 'reject' | 'pending'; reason?: string; consistency_check?: { passed: boolean; issues: string[] } }
  output?: { url: string; type: 'video'; thumbnail?: string }
}

interface Segments05Content {
  step?: string
  episode?: string
  version?: string
  segments?: Segment[]
  platform_slot?: { primary: string; candidates?: string[]; locked?: boolean; note?: string }
  note?: string
  pending_schema?: boolean
}

export function Segments05View({ version }: { version: StepVersion }) {
  const c = version.content as Segments05Content
  const segs = c.segments ?? []
  const slot = c.platform_slot ?? {
    primary: '(未定)',
    candidates: ['seedance', 'kling', 'wan', 'comfyui'],
    locked: false,
    note: '05 视频平台多选：先讨论再定；拿不准找导演确认',
  }

  const adopted = segs.filter((s) => s.selection?.decision === 'adopt').length
  const rejected = segs.filter((s) => s.selection?.decision === 'reject').length

  return (
    <div className="step-seg05">
      {c.pending_schema && (
        <div className="callout info">05 schema 占位中；下方含筛镜头记录壳。</div>
      )}
      {c.note && <p className="muted">{c.note}</p>}

      <div className={`platform-slot ${slot.locked === false ? 'unlocked' : ''}`}>
        <div className="ps-head">平台入口 · 步骤 05（视频）</div>
        <div className="ps-row">
          <span className="chip warn">主：{slot.primary}{slot.locked === false ? ' · 未锁定' : ''}</span>
          {(slot.candidates ?? []).map((p) => (
            <span key={p} className="chip">{p}</span>
          ))}
        </div>
        {slot.note && <div className="hint">{slot.note}</div>}
      </div>

      <div className="docmeta">
        <div className="row">
          <span><b>segments</b> {segs.length}</span>
          <span>采用 {adopted}</span>
          <span>淘汰 {rejected}</span>
          <span className="mono">{version.archive_path}</span>
        </div>
      </div>

      {segs.length === 0 ? (
        <div className="empty">暂无分段视频（平台选定并 Job 回写后展示；可在此筛镜头）</div>
      ) : (
        <div className="seg-list">
          {segs.map((seg) => {
            const sel = seg.selection?.decision ?? 'pending'
            return (
              <article key={seg.seg_id} className={`seg-card sel-${sel}`}>
                <header>
                  <b>{seg.seg_id}</b>
                  <span className="chip">{seg.duration_s}s</span>
                  <span className={`st st-${sel === 'adopt' ? 'approved' : sel === 'reject' ? 'failed' : 'awaiting_review'}`}>
                    {sel === 'adopt' ? '采用' : sel === 'reject' ? '淘汰' : '待筛'}
                  </span>
                </header>
                <div className="view-cell wide">
                  <div className="ph">🎬</div>
                  <div className="url mono">{seg.output?.url ?? '（未出片）'}</div>
                </div>
                <div className="kv">
                  {seg.keyframe_refs && (
                    <div>
                      <span className="k">首尾帧</span>
                      <span className="v mono">{[seg.keyframe_refs.first, seg.keyframe_refs.last].filter(Boolean).join(' → ') || '—'}</span>
                    </div>
                  )}
                  {seg.prompt && (
                    <>
                      {seg.prompt.shot && <div><span className="k">镜头</span><span className="v">{seg.prompt.shot}</span></div>}
                      {seg.prompt.action && <div><span className="k">动作</span><span className="v">{seg.prompt.action}</span></div>}
                      {seg.prompt.dialogue && <div><span className="k">台词</span><span className="v">{seg.prompt.dialogue}</span></div>}
                      {seg.prompt.emotion && <div><span className="k">情绪</span><span className="v">{seg.prompt.emotion}</span></div>}
                      {seg.prompt.sfx && <div><span className="k">音效</span><span className="v">{seg.prompt.sfx}</span></div>}
                    </>
                  )}
                  {seg.selection?.reason && (
                    <div><span className="k">筛选理由</span><span className="v">{seg.selection.reason}</span></div>
                  )}
                  {seg.selection?.consistency_check && (
                    <div>
                      <span className="k">一致性</span>
                      <span className={`v ${seg.selection.consistency_check.passed ? 'ok' : 'bad'}`}>
                        {seg.selection.consistency_check.passed
                          ? 'passed'
                          : seg.selection.consistency_check.issues.join('; ')}
                      </span>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <h4>版本参数 / seed</h4>
      <div className="kv">
        <div><span className="k">model</span><span className="v">{version.model ?? '—'}</span></div>
        <div><span className="k">seed</span><span className="v">{version.seed ?? '—'}</span></div>
      </div>
    </div>
  )
}
