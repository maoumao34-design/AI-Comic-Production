import type { StepVersion } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'

interface SubjectAsset {
  subject_type?: string
  subject_id?: string
  views?: string[]
  prompt?: string
  consistency_ref?: string
  consistency_check?: { passed?: boolean; issues?: string[] }
  status?: string
}

interface Assets03Content {
  subjects?: SubjectAsset[]
  prompt?: string
  note?: string
  pending_schema?: boolean
}

/** 03 一致性资产：subjects + 图预览 + 一致性检查 */
export function Assets03View({ version }: { version: StepVersion }) {
  const c = (version.content ?? {}) as Assets03Content
  const subjects = c.subjects ?? []

  return (
    <div className="step-assets">
      {c.pending_schema && (
        <div className="callout info">03 schema 字段按 STEP-CONTENT-SCHEMA-03-04-05；后端未填 subjects 时先看产物。</div>
      )}
      {c.note && <p className="muted">{c.note}</p>}
      {c.prompt && (
        <div className="docmeta">
          <div><span className="k">prompt</span><span className="v">{c.prompt}</span></div>
        </div>
      )}

      <h4>一致性资产（subjects）</h4>
      {subjects.length === 0 ? (
        <div className="empty">尚无 subject 结构化字段 · 见下方产物图</div>
      ) : (
        <div className="subject-grid">
          {subjects.map((s, i) => (
            <div key={s.subject_id ?? i} className="subject-card">
              <div className="beat-head">
                <span className="bid">{s.subject_id ?? `subject-${i + 1}`}</span>
                {s.subject_type && <span className="chip">{s.subject_type}</span>}
                {s.status && <span className="chip">{s.status}</span>}
              </div>
              {s.views && s.views.length > 0 && (
                <div className="row"><b>views</b>{s.views.map((v) => <span key={v} className="chip">{v}</span>)}</div>
              )}
              {s.prompt && <p className="narration">{s.prompt}</p>}
              {s.consistency_ref && <div className="mono">ref: {s.consistency_ref}</div>}
              {s.consistency_check && (
                <div className={`chip ${s.consistency_check.passed ? '' : 'warn'}`}>
                  consistency: {s.consistency_check.passed ? 'passed' : 'issues'}
                  {s.consistency_check.issues?.length ? ` · ${s.consistency_check.issues.join('; ')}` : ''}
                </div>
              )}
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
