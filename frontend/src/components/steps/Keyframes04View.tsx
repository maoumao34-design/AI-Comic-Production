import type { StepVersion } from '../../types'

/** 04 关键帧（对齐 STEP-CONTENT-SCHEMA-03-04-05） */
interface Keyframe {
  kf_id: string
  source_shot_id: string
  shot?: { 景别?: string; angle?: string; composition?: string }
  asset_refs?: string[]
  characters_in_frame?: string[]
  prompt?: string
  output?: { url: string; type: 'image'; thumbnail?: string }
}

interface Keyframes04Content {
  step?: string
  episode?: string
  version?: string
  keyframes?: Keyframe[]
  platform_slot?: { primary: string; candidates?: string[]; note?: string }
  note?: string
  pending_schema?: boolean
}

export function Keyframes04View({ version }: { version: StepVersion }) {
  const c = version.content as Keyframes04Content
  const frames = c.keyframes ?? []
  const slot = c.platform_slot ?? { primary: 'comfyui', candidates: ['comfyui'], note: '04 默认 ComfyUI，引用 03 locked 资产' }

  return (
    <div className="step-kf04">
      {c.pending_schema && (
        <div className="callout info">04 schema 占位中；下方为关键帧审片壳。</div>
      )}
      {c.note && <p className="muted">{c.note}</p>}

      <div className="platform-slot">
        <div className="ps-head">平台入口 · 步骤 04</div>
        <div className="ps-row">
          <span className="chip">主：{slot.primary}</span>
          {(slot.candidates ?? []).map((p) => (
            <span key={p} className="chip">{p}</span>
          ))}
        </div>
        {slot.note && <div className="hint">{slot.note}</div>}
      </div>

      <div className="docmeta">
        <div className="row">
          <span><b>keyframes</b> {frames.length}</span>
          <span className="mono">{version.archive_path}</span>
        </div>
      </div>

      {frames.length === 0 ? (
        <div className="empty">暂无关键帧（等 03 通过后 Job 生成）</div>
      ) : (
        <div className="kf-grid">
          {frames.map((kf) => (
            <article key={kf.kf_id} className="kf-card">
              <header>
                <b>{kf.kf_id}</b>
                <span className="chip">shot {kf.source_shot_id}</span>
              </header>
              <div className="view-cell">
                <div className="ph">🖼</div>
                <div className="url mono">{kf.output?.url ?? '（未出图）'}</div>
              </div>
              <div className="kv">
                {kf.shot && (
                  <div>
                    <span className="k">镜头</span>
                    <span className="v">
                      {[kf.shot.景别, kf.shot.angle, kf.shot.composition].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                )}
                {kf.characters_in_frame && kf.characters_in_frame.length > 0 && (
                  <div><span className="k">角色</span><span className="v">{kf.characters_in_frame.join('、')}</span></div>
                )}
                {kf.asset_refs && kf.asset_refs.length > 0 && (
                  <div><span className="k">03 refs</span><span className="v mono">{kf.asset_refs.join(' ')}</span></div>
                )}
                {kf.prompt && <div><span className="k">prompt</span><span className="v">{kf.prompt}</span></div>}
              </div>
            </article>
          ))}
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
