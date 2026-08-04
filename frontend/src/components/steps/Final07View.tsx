import type { StepVersion } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'

interface Final07Content {
  cut?: {
    duration_ms?: number
    aspect?: string
    resolution?: number[]
    fps?: number
    video?: { url?: string; container?: string; vcodec?: string; acodec?: string }
  }
  tracks?: {
    voiceover_ref?: string
    clips_ref?: string
    music?: { url?: string; label?: string; gain_db?: number }[]
    sfx?: { url?: string; at_ms?: number; label?: string }[]
  }
  subtitle?: { burn_in?: boolean; language?: string }
  color?: { lut?: string; grade?: string }
  edit_project?: { tool?: string; project_file_url?: string }
  delivery_spec_id?: string
  note?: string
}

/** 07 后期合成成片 */
export function Final07View({ version }: { version: StepVersion }) {
  const c = (version.content ?? {}) as Final07Content
  const cut = c.cut

  return (
    <div className="step-final">
      {c.note && <p className="muted">{c.note}</p>}
      <div className="docmeta">
        <div className="row">
          <span><b>画幅</b> {cut?.aspect ?? '—'}</span>
          <span><b>分辨率</b> {cut?.resolution ? cut.resolution.join('×') : '—'}</span>
          <span><b>fps</b> {cut?.fps ?? '—'}</span>
          <span><b>时长</b> {cut?.duration_ms != null ? `${(cut.duration_ms / 1000).toFixed(1)}s` : '—'}</span>
        </div>
        <div className="row">
          <span><b>字幕烧录</b> {c.subtitle?.burn_in == null ? '—' : String(c.subtitle.burn_in)}</span>
          <span><b>字幕语言</b> {c.subtitle?.language ?? '—'}</span>
          <span><b>合成工具</b> {c.edit_project?.tool ?? '—'}</span>
          <span><b>delivery</b> {c.delivery_spec_id ?? '—'}</span>
        </div>
        {c.tracks && (
          <div className="kv">
            {c.tracks.voiceover_ref && <div><span className="k">VO</span><span className="v mono">{c.tracks.voiceover_ref}</span></div>}
            {c.tracks.clips_ref && <div><span className="k">clips</span><span className="v mono">{c.tracks.clips_ref}</span></div>}
          </div>
        )}
      </div>

      <h4>成片预览</h4>
      <ArtifactGallery artifacts={version.artifacts} />

      <h4>参数 / 归档</h4>
      <div className="kv">
        <div><span className="k">归档</span><span className="v mono">{version.archive_path}</span></div>
        {c.edit_project?.project_file_url && (
          <div><span className="k">工程</span><span className="v mono">{c.edit_project.project_file_url}</span></div>
        )}
      </div>
    </div>
  )
}
