import type { StepVersion } from '../../types'

/** 02 分镜表：shots[]，linked_beat_id 外键→01 beat（对齐 CONTENT-SCHEMA-01-02 §2、§3） */
interface Shot {
  shot_id: string
  linked_beat_id: string
  shot_no: string
  characters: string[]
  action: string
  scene: string
  evidence_visual: string
  shot_type?: string
  duration_sec?: number
  ref_image_slot?: string | null
  notes?: string
}
interface Storyboard02Content {
  source_narration?: { episode: string; version: string }
  shots_count?: number
  est_total_duration_sec?: number
  open_specs?: string[]
  shots: Shot[]
}

export function Storyboard02View({ version }: { version: StepVersion }) {
  const c = (version.content ?? {}) as Storyboard02Content
  const shots = Array.isArray(c.shots) ? c.shots : []
  if (!shots.length) {
    return (
      <div className="step-storyboard">
        <div className="empty">分镜 content.shots 缺失或格式不对；请查看下方产物 / 接手面板中的 output.md</div>
      </div>
    )
  }
  return (
    <div className="step-storyboard">
      <div className="docmeta">
        {c.source_narration && (
          <div><span className="k">依据解说词</span><span className="v">{c.source_narration.episode} · {c.source_narration.version}</span></div>
        )}
        <div className="row">
          <span><b>镜头数</b> {c.shots_count ?? shots.length}</span>
          <span><b>预估总时长</b> {c.est_total_duration_sec ?? '—'}s</span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="shots">
          <thead>
            <tr><th>镜头号</th><th>旁白</th><th>人物</th><th>动作</th><th>场景</th><th>证据画面</th><th>景别</th><th>时长</th></tr>
          </thead>
          <tbody>
            {shots.map((s) => (
              <tr key={s.shot_id} id={`shot-${s.shot_id}`}>
                <td><b>{s.shot_no}</b></td>
                <td><a className="beatref" href={`#beat-${s.linked_beat_id}`} title="跳到对应旁白">{s.linked_beat_id}</a></td>
                <td>{Array.isArray(s.characters) ? s.characters.join('、') : '—'}</td>
                <td>{s.action}</td>
                <td>{s.scene}</td>
                <td>{s.evidence_visual}</td>
                <td>{s.shot_type ?? '—'}</td>
                <td>{s.duration_sec ? `${s.duration_sec}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">铁律：每条旁白（beat）至少对应 1 个镜头（linked_beat_id 外键完整）。点"旁白"列可跳到 01 对应节拍。</p>
    </div>
  )
}
