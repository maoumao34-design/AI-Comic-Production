import type { StepVersion } from '../../types'

/** 01 解说词：doc-level 字段 + beats[]（对齐 CONTENT-SCHEMA-01-02 §1） */
interface Beat {
  beat_id: string
  scene_label?: string
  narration_text: string
  preserved_dialogue?: { text: string; character: string }[]
  emotion?: string
  visual_hint: string
}
interface Script01Content {
  one_line_premise?: string
  emotion_arc?: Record<string, string>
  narration_language?: string
  est_duration_sec?: number
  word_count?: number
  word_count_target?: { min: number; max: number; chars_per_sec: string }
  beats_count?: number
  adaptation?: { boundary_confirmed?: boolean; policy?: string }
  open_specs?: string[]
  beats: Beat[]
}

export function Script01View({ version }: { version: StepVersion }) {
  const c = version.content as Script01Content
  return (
    <div className="step-script">
      <div className="docmeta">
        <div><span className="k">一句话主线</span><span className="v">{c.one_line_premise}</span></div>
        <div className="row">
          <span><b>语言</b> {c.narration_language ?? '—'}</span>
          <span><b>预估时长</b> {c.est_duration_sec ?? '—'}s</span>
          <span><b>字数</b> {c.word_count ?? '—'} / 目标 {c.word_count_target ? `${c.word_count_target.min}–${c.word_count_target.max}` : '210–480'}</span>
          <span><b>节拍</b> {c.beats_count ?? c.beats.length}</span>
        </div>
        {c.emotion_arc && (
          <div className="row">
            <b>情绪弧线</b>
            {Object.entries(c.emotion_arc).map(([k, v]) => (
              <span key={k} className="chip">{k}:{v}</span>
            ))}
          </div>
        )}
        {c.adaptation && <div><span className="k">改编策略</span><span className="v">{c.adaptation.policy}（边界确认：{c.adaptation.boundary_confirmed ? '是' : '否'}）</span></div>}
        {c.open_specs && c.open_specs.length > 0 && (
          <div className="row open"><b>待定规格</b>{c.open_specs.map((s) => <span key={s} className="chip warn">{s}</span>)}</div>
        )}
      </div>

      <h4>旁白节拍（beats）</h4>
      <div className="beats">
        {c.beats.map((b) => (
          <div key={b.beat_id} className="beat" id={`beat-${b.beat_id}`}>
            <div className="beat-head">
              <span className="bid">{b.beat_id}</span>
              {b.scene_label && <span className="scene">{b.scene_label}</span>}
              {b.emotion && <span className="chip">{b.emotion}</span>}
            </div>
            <p className="narration">{b.narration_text}</p>
            {b.preserved_dialogue && b.preserved_dialogue.length > 0 && (
              <div className="dialogues">
                {b.preserved_dialogue.map((d, i) => (
                  <span key={i} className="dialogue">「{d.text}」— {d.character}</span>
                ))}
              </div>
            )}
            <div className="vhint"><b>画面提示→02</b> {b.visual_hint}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
