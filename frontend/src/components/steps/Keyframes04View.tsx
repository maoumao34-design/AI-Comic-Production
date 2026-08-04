import type { StepVersion } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'

interface Keyframe {
  kf_id?: string
  source_shot_id?: string
  shot?: { 景别?: string; angle?: string; composition?: string; [k: string]: unknown }
  asset_refs?: string[]
  characters_in_frame?: string[]
  prompt?: string
}

interface Keyframes04Content {
  keyframes?: Keyframe[]
  prompt?: string
  note?: string
  pending_schema?: boolean
}

/** 04 关键帧 */
export function Keyframes04View({ version }: { version: StepVersion }) {
  const c = (version.content ?? {}) as Keyframes04Content
  const frames = c.keyframes ?? []

  return (
    <div className="step-keyframes">
      {c.note && <p className="muted">{c.note}</p>}
      <h4>关键帧</h4>
      {frames.length === 0 ? (
        <div className="empty">尚无 keyframes 结构化字段 · 见下方产物</div>
      ) : (
        <div className="table-wrap">
          <table className="shots">
            <thead>
              <tr>
                <th>kf</th>
                <th>shot</th>
                <th>景别/角度</th>
                <th>角色</th>
                <th>03 refs</th>
                <th>prompt</th>
              </tr>
            </thead>
            <tbody>
              {frames.map((f, i) => (
                <tr key={f.kf_id ?? i}>
                  <td className="mono">{f.kf_id ?? `kf${i + 1}`}</td>
                  <td>{f.source_shot_id ?? '—'}</td>
                  <td>{[f.shot?.景别, f.shot?.angle, f.shot?.composition].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{(f.characters_in_frame ?? []).join(', ') || '—'}</td>
                  <td className="mono">{(f.asset_refs ?? []).join(' ')}</td>
                  <td>{f.prompt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
