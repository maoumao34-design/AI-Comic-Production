import type { StepVersion } from '../types'

/** 接手 agent / 人类共读：归档路径 + 结构化 content + 产物清单（P0 §7 验收点） */
export function HandoffPanel({ version }: { version: StepVersion }) {
  return (
    <div className="handoff-panel">
      <div className="ps-head">接手可读 · 归档与结果</div>
      <div className="kv">
        <div><span className="k">archive</span><span className="v mono">{version.archive_path}</span></div>
        {version.prompt_path && (
          <div><span className="k">prompt</span><span className="v mono">{version.prompt_path}</span></div>
        )}
        {version.meta_path && (
          <div><span className="k">meta</span><span className="v mono">{version.meta_path}</span></div>
        )}
        <div><span className="k">episode</span><span className="v mono">{version.episode_id}</span></div>
        <div><span className="k">step/ver</span><span className="v mono">{version.step} / {version.version}{version.is_latest ? ' · latest' : ''}</span></div>
        <div><span className="k">status</span><span className={`st st-${version.status}`}>{version.status}</span></div>
      </div>

      <h4>产物清单（artifacts）</h4>
      {version.artifacts.length === 0 ? (
        <div className="empty">暂无产物文件 · 生成后落盘到 archive 并在此可见</div>
      ) : (
        <ul className="handoff-arts">
          {version.artifacts.map((a, i) => (
            <li key={i}>
              <span className="chip">{a.type}</span>
              <span>{a.label}</span>
              <span className="mono">{a.url}</span>
            </li>
          ))}
        </ul>
      )}

      <h4>content（结构化，agent 可读）</h4>
      <pre className="content-json">{safeJson(version.content)}</pre>
    </div>
  )
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}
