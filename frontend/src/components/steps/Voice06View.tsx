import type { StepVersion } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'

interface Cue {
  index: number
  start_ms: number
  end_ms: number
  text: string
}

interface Voice06Content {
  voiceover?: {
    tts?: string
    model?: string
    voice_id?: string
    language?: string
    speed?: number
    audio?: { url?: string; duration_ms?: number }
  }
  subtitle_track?: {
    format?: string
    language?: string
    burn_in?: boolean
    file_url?: string
    cues?: Cue[]
  }
  script_ref?: string
  clips_ref?: string
  note?: string
}

/** 06 配音字幕 */
export function Voice06View({ version }: { version: StepVersion }) {
  const c = (version.content ?? {}) as Voice06Content
  const cues = c.subtitle_track?.cues ?? []

  return (
    <div className="step-voice">
      {c.note && <p className="muted">{c.note}</p>}
      <div className="docmeta">
        <div><span className="k">TTS</span><span className="v">{c.voiceover?.tts ?? version.model ?? '—'}</span></div>
        <div className="row">
          <span><b>model</b> {c.voiceover?.model ?? '—'}</span>
          <span><b>voice</b> {c.voiceover?.voice_id ?? '—'}</span>
          <span><b>lang</b> {c.voiceover?.language ?? c.subtitle_track?.language ?? '—'}</span>
          <span><b>burn-in</b> {c.subtitle_track?.burn_in == null ? '—' : String(c.subtitle_track.burn_in)}</span>
        </div>
        {(c.script_ref || c.clips_ref) && (
          <div className="kv">
            {c.script_ref && <div><span className="k">script_ref</span><span className="v mono">{c.script_ref}</span></div>}
            {c.clips_ref && <div><span className="k">clips_ref</span><span className="v mono">{c.clips_ref}</span></div>}
          </div>
        )}
      </div>

      <h4>字幕轨 cues</h4>
      {cues.length === 0 ? (
        <div className="empty">尚无字幕 cue</div>
      ) : (
        <div className="table-wrap">
          <table className="shots">
            <thead>
              <tr><th>#</th><th>start</th><th>end</th><th>text</th></tr>
            </thead>
            <tbody>
              {cues.map((cue) => (
                <tr key={cue.index}>
                  <td>{cue.index}</td>
                  <td className="mono">{ms(cue.start_ms)}</td>
                  <td className="mono">{ms(cue.end_ms)}</td>
                  <td>{cue.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4>产物预览</h4>
      <ArtifactGallery artifacts={version.artifacts} />
    </div>
  )
}

function ms(n: number): string {
  const s = Math.floor(n / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  const frac = String(n % 1000).padStart(3, '0')
  return `${m}:${String(r).padStart(2, '0')}.${frac}`
}
