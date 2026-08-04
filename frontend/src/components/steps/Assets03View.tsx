import type { StepVersion } from '../../types'

/** 03 一致性资产：subject 粒度（对齐 STEP-CONTENT-SCHEMA-03-04-05） */
type SubjectType = 'character' | 'costume' | 'expression' | 'scene' | 'prop'

interface SubjectAsset {
  subject_type: SubjectType
  subject_id: string
  label?: string
  views?: { front?: string; side?: string; back?: string }
  consistency_ref?: string | null
  consistency_check?: { passed: boolean; issues: string[] }
  status?: 'draft' | 'latest' | 'locked'
  prompt?: string
  output?: { url: string; type: 'image' | 'video'; thumbnail?: string }
}

interface Assets03Content {
  step?: string
  episode?: string
  version?: string
  subjects?: SubjectAsset[]
  platform_slot?: { primary: string; candidates?: string[]; note?: string }
  note?: string
  pending_schema?: boolean
}

function viewEntries(s: SubjectAsset): { name: string; url: string }[] {
  const out: { name: string; url: string }[] = []
  if (s.views) {
    for (const k of ['front', 'side', 'back'] as const) {
      const u = s.views[k]
      if (u) out.push({ name: k, url: u })
    }
  }
  if (out.length === 0 && s.output?.url) out.push({ name: 'output', url: s.output.url })
  return out
}

export function Assets03View({ version }: { version: StepVersion }) {
  const c = version.content as Assets03Content
  const subjects = c.subjects ?? []
  const slot = c.platform_slot ?? { primary: 'comfyui', candidates: ['comfyui'], note: '03 默认 ComfyUI' }

  return (
    <div className="step-assets03">
      {c.pending_schema && (
        <div className="callout info">03 schema 占位中；下方为通用/样例渲染，定稿后切完整字段。</div>
      )}
      {c.note && <p className="muted">{c.note}</p>}

      <div className="platform-slot">
        <div className="ps-head">平台入口 · 步骤 03</div>
        <div className="ps-row">
          <span className="chip">主：{slot.primary}</span>
          {(slot.candidates ?? []).map((p) => (
            <span key={p} className="chip">{p}</span>
          ))}
        </div>
        {slot.note && <div className="hint">{slot.note}</div>}
        <div className="hint">提交生成走后端 Job（decision: revise/regenerate）；本面板只展示入口与归档，不伪造出图。</div>
      </div>

      <div className="docmeta">
        <div className="row">
          <span><b>subjects</b> {subjects.length}</span>
          <span className="mono">{version.archive_path}</span>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="empty">暂无一致性资产 subjects（等平台 Job 回写 assets/…/outputs/）</div>
      ) : (
        <div className="subject-grid">
          {subjects.map((s) => {
            const views = viewEntries(s)
            const check = s.consistency_check
            return (
              <article key={s.subject_id} className="subject-card">
                <header>
                  <span className="chip">{s.subject_type}</span>
                  <b>{s.label ?? s.subject_id}</b>
                  {s.status && <span className={`st st-${s.status === 'locked' ? 'approved' : 'awaiting_review'}`}>{s.status}</span>}
                </header>
                <div className="view-row">
                  {views.length === 0 ? (
                    <div className="ph-empty">无预览</div>
                  ) : (
                    views.map((v) => (
                      <div key={v.name} className="view-cell">
                        <div className="ph">🖼</div>
                        <div className="lbl">{v.name}</div>
                        <div className="url mono">{v.url}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="kv">
                  <div><span className="k">id</span><span className="v mono">{s.subject_id}</span></div>
                  {s.consistency_ref && (
                    <div><span className="k">consistency_ref</span><span className="v mono">{s.consistency_ref}</span></div>
                  )}
                  {check && (
                    <div>
                      <span className="k">consistency</span>
                      <span className={`v ${check.passed ? 'ok' : 'bad'}`}>
                        {check.passed ? 'passed' : `issues: ${check.issues.join('; ') || '—'}`}
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
        {version.refs && version.refs.length > 0 && (
          <div><span className="k">refs</span><span className="v mono">{version.refs.join(' ')}</span></div>
        )}
      </div>
    </div>
  )
}
