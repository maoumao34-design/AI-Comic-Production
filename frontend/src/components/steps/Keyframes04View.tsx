import type { StepVersion } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'

/** 04 关键帧（对齐 STEP-CONTENT-SCHEMA-03-04-05） */
interface Keyframe {
  kf_id?: string
  source_shot_id?: string
  shot?: { 景别?: string; angle?: string; composition?: string; [k: string]: unknown }
  asset_refs?: string[]
  characters_in_frame?: string[]
  prompt?: string
  output?: { url: string; type: 'image'; thumbnail?: string }
}

interface Keyframes04Content {
  keyframes?: Keyframe[]
  prompt?: string
  note?: string
  pending_schema?: boolean
}

/** 04 关键帧审片。平台槽位由 PlatformSlotPanel 统一渲染。 */
export function Keyframes04View({ version }: { version: StepVersion }) {
  const c = (version.content ?? {}) as Keyframes04Content
  const frames = c.keyframes ?? []

  return (
    <div className="step-keyframes">
      {c.pending_schema && (
        <div className="callout info">04 schema 占位中；下方为关键帧审片壳。</div>
      )}
      {c.note && <p className="muted">{c.note}</p>}
      {c.prompt && (
        <div className="docmeta">
          <div><span className="k">prompt</span><span className="v">{c.prompt}</span></div>
        </div>
      )}

      <div className="docmeta">
        <div className="row">
          <span><b>keyframes</b> {frames.length}</span>
          <span className="mono">{version.archive_path}</span>
        </div>
      </div>

      <h4>关键帧</h4>
      {frames.length === 0 ? (
        <div className="empty">尚无 keyframes 结构化字段 · 见下方产物</div>
      ) : (
        <div className="kf-grid">
          {frames.map((kf, i) => (
            <article key={kf.kf_id ?? i} className="kf-card">
              <header>
                <b>{kf.kf_id ?? `kf${i + 1}`}</b>
                {kf.source_shot_id && <span className="chip">shot {kf.source_shot_id}</span>}
              </header>
              <div className="view-cell">
                <div className="ph">🖼</div>
                <div className="url mono">{kf.output?.url ?? '（未出图 · 见产物预览）'}</div>
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
