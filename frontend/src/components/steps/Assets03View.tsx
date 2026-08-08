import { useEffect, useState } from 'react'
import type { StepVersion } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'
import { MediaLightbox } from '../MediaLightbox'

/** 03 一致性资产：subject 粒度（对齐 STEP-CONTENT-SCHEMA-03-04-05） */
type SubjectType = 'character' | 'costume' | 'expression' | 'scene' | 'prop'

interface SubjectAsset {
  subject_type?: SubjectType | string
  subject_id?: string
  asset_id?: string
  label?: string
  /** schema: { front/side/back }；兼容旧 mock string[] */
  views?: { front?: string; side?: string; back?: string } | string[]
  consistency_ref?: string | null
  consistency_check?: { passed?: boolean; issues?: string[] }
  status?: 'draft' | 'latest' | 'locked' | string
  prompt?: string
  prompt_excerpt?: string
  kind?: string
  output?: { url: string; type: 'image' | 'video'; thumbnail?: string }
}

interface Assets03Content {
  subjects?: SubjectAsset[]
  assets?: SubjectAsset[]
  series_id?: string
  prompt?: string
  note?: string
  pending_schema?: boolean
}

interface SeriesSubject {
  subject_id: string
  subject_type?: string
  consistency_ref?: string
  status?: string
  artifact_url?: string
  source_episode?: string
}

interface SeriesPack {
  series_id: string
  subject_count: number
  source_episodes?: string[]
  subjects: SeriesSubject[]
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

function normalizeSubjects(c: Assets03Content): SubjectAsset[] {
  if (Array.isArray(c.subjects) && c.subjects.length > 0) return c.subjects
  if (Array.isArray(c.assets) && c.assets.length > 0) {
    return c.assets.map((a) => ({
      ...a,
      subject_id: a.subject_id || a.asset_id,
      label: a.label || a.subject_id || a.asset_id,
      subject_type: a.subject_type || (String(a.asset_id || '').startsWith('char/') ? 'character' : undefined),
      prompt: a.prompt || a.prompt_excerpt,
    }))
  }
  return []
}

/** 03 一致性资产：subjects + 系列锁定参考 + 产物预览 */
export function Assets03View({ version, episodeId }: { version: StepVersion; episodeId?: string }) {
  const c = (version.content ?? {}) as Assets03Content
  const subjects = normalizeSubjects(c)
  const [pack, setPack] = useState<SeriesPack | null>(null)
  const [lb, setLb] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const path = episodeId
          ? `/api/v1/episodes/${encodeURIComponent(episodeId)}/series-refs`
          : '/api/v1/series/consistency'
        const res = await fetch(path)
        if (!res.ok) return
        const j = (await res.json()) as { pack: SeriesPack }
        if (!cancelled) setPack(j.pack)
      } catch {
        /* mock / offline */
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [episodeId, version.version, version.status])

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

      {pack && pack.subject_count > 0 && (
        <section className="series-pack">
          <h4>系列锁定参考 · {pack.series_id}</h4>
          <p className="muted">
            同系列后续集默认复用这些图（03 ✅ 后晋升）。来源集：{(pack.source_episodes || []).join(', ') || '—'}
          </p>
          <div className="subject-grid series-grid">
            {pack.subjects.map((s) => (
              <article key={s.consistency_ref || s.subject_id} className="subject-card">
                <header>
                  {s.subject_type && <span className="chip">{s.subject_type}</span>}
                  <b>{s.subject_id}</b>
                  <span className="st st-approved">{s.status || 'locked'}</span>
                </header>
                {s.artifact_url ? (
                  <div className="view-row">
                    <div className="view-cell">
                      <button
                        type="button"
                        className="art-zoom"
                        title="点击放大"
                        onClick={() => setLb({ src: s.artifact_url!, alt: s.subject_id })}
                      >
                        <img src={s.artifact_url} alt={s.subject_id} className="series-thumb" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ph-empty">无预览</div>
                )}
                <div className="kv">
                  {s.consistency_ref && (
                    <div><span className="k">consistency_ref</span><span className="v mono">{s.consistency_ref}</span></div>
                  )}
                  {s.source_episode && (
                    <div><span className="k">from</span><span className="v mono">{s.source_episode}</span></div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="docmeta">
        <div className="row">
          <span><b>subjects</b> {subjects.length}</span>
          {c.series_id && <span className="mono">series:{c.series_id}</span>}
          <span className="mono">{version.archive_path}</span>
        </div>
      </div>

      <h4>本集一致性资产（subjects）</h4>
      {subjects.length === 0 ? (
        <div className="empty">尚无 subject 结构化字段 · 见下方产物图。✅ 通过后将晋升到系列包。</div>
      ) : (
        <div className="subject-grid">
          {subjects.map((s, i) => {
            const views = viewEntries(s)
            const check = s.consistency_check
            return (
              <article key={s.subject_id ?? s.asset_id ?? i} className="subject-card">
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
                        {v.url ? (
                          <button
                            type="button"
                            className="art-zoom"
                            title="点击放大"
                            onClick={() =>
                              setLb({
                                src: v.url!,
                                alt: `${s.label ?? s.subject_id ?? ''} · ${v.name}`,
                              })
                            }
                          >
                            <img src={v.url} alt={v.name} className="series-thumb" />
                          </button>
                        ) : (
                          <div className="ph">🖼</div>
                        )}
                        <div className="lbl">{v.name}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="kv">
                  {(s.subject_id || s.asset_id) && (
                    <div><span className="k">id</span><span className="v mono">{s.subject_id || s.asset_id}</span></div>
                  )}
                  {(s.prompt || s.prompt_excerpt) && (
                    <div><span className="k">prompt</span><span className="v">{s.prompt || s.prompt_excerpt}</span></div>
                  )}
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

      {lb && <MediaLightbox src={lb.src} alt={lb.alt} onClose={() => setLb(null)} />}

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
