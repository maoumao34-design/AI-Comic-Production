import type { StepVersion } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'

/** 03 一致性资产：subject 粒度（对齐 STEP-CONTENT-SCHEMA-03-04-05） */
type SubjectType = 'character' | 'costume' | 'expression' | 'scene' | 'prop'

interface SubjectAsset {
  subject_type?: SubjectType | string
  subject_id?: string
  label?: string
  /** schema: { front/side/back }；兼容旧 mock string[] */
  views?: { front?: string; side?: string; back?: string } | string[]
  consistency_ref?: string | null
  consistency_check?: { passed?: boolean; issues?: string[] }
  status?: 'draft' | 'latest' | 'locked' | string
  prompt?: string
  output?: { url: string; type: 'image' | 'video'; thumbnail?: string }
}

interface Assets03Content {
  subjects?: SubjectAsset[]
  prompt?: string
  note?: string
  pending_schema?: boolean
}

function viewEntries(s: SubjectAsset): { name: string; url?: string }[] {
  const out: { name: string; url?: string }[] = []
  if (Array.isArray(s.views)) {
    for (const name of s.views) out.push({ name })
    return out
  }
  if (s.views) {
    for (const k of ['front', 'side', 'back'] as const) {
      const u = s.views[k]
      if (u) out.push({ name: k, url: u })
    }
  }
  if (out.length === 0 && s.output?.url) out.push({ name: 'output', url: s.output.url })
  return out
}

/** 03 一致性资产：subjects + 图预览 + 一致性检查。平台槽位由 PlatformSlotPanel 统一渲染。 */
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

      <div className="docmeta">
        <div className="row">
          <span><b>subjects</b> {subjects.length}</span>
          <span className="mono">{version.archive_path}</span>
        </div>
      </div>

      <h4>一致性资产（subjects）</h4>
      {subjects.length === 0 ? (
        <div className="empty">尚无 subject 结构化字段 · 见下方产物图</div>
      ) : (
        <div className="subject-grid">
          {subjects.map((s, i) => {
            const views = viewEntries(s)
            const check = s.consistency_check
            return (
              <article key={s.subject_id ?? i} className="subject-card">
                <header>
                  {s.subject_type && <span className="chip">{s.subject_type}</span>}
                  <b>{s.label ?? s.subject_id ?? `subject-${i + 1}`}</b>
                  {s.status && (
                    <span className={`st st-${s.status === 'locked' ? 'approved' : 'awaiting_review'}`}>{s.status}</span>
                  )}
                </header>
                <div className="view-row">
                  {views.length === 0 ? (
                    <div className="ph-empty">无预览</div>
                  ) : (
                    views.map((v) => (
                      <div key={v.name} className="view-cell">
                        <div className="ph">🖼</div>
                        <div className="lbl">{v.name}</div>
                        {v.url && <div className="url mono">{v.url}</div>}
                      </div>
                    ))
                  )}
                </div>
                <div className="kv">
                  {s.subject_id && (
                    <div><span className="k">id</span><span className="v mono">{s.subject_id}</span></div>
                  )}
                  {s.prompt && <div><span className="k">prompt</span><span className="v">{s.prompt}</span></div>}
                  {s.consistency_ref && (
                    <div><span className="k">consistency_ref</span><span className="v mono">{s.consistency_ref}</span></div>
                  )}
                  {check && (
                    <div>
                      <span className="k">consistency</span>
                      <span className={`v ${check.passed ? 'ok' : 'bad'}`}>
                        {check.passed ? 'passed' : `issues: ${(check.issues ?? []).join('; ') || '—'}`}
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
        {version.refs && version.refs.length > 0 && (
          <div><span className="k">refs</span><span className="v mono">{version.refs.join(' ')}</span></div>
        )}
      </div>
    </div>
  )
}
