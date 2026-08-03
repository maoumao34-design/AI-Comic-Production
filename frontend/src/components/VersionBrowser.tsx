import type { StepVersion } from '../types'

/** 版本列表 + 切换（PER-STEP-UI-SPEC §2 VersionBrowser） */
export function VersionBrowser({
  versions,
  current,
  onSelect,
}: {
  versions: StepVersion[]
  current?: StepVersion
  onSelect: (v: StepVersion) => void
}) {
  const sorted = [...versions].sort((a, b) => (a.version < b.version ? 1 : -1))
  return (
    <div className="version-browser">
      <div className="vb-head">版本归档（{versions.length}）</div>
      {sorted.length === 0 && <div className="empty">该步暂无版本</div>}
      <ul>
        {sorted.map((v) => {
          const active = current?.version === v.version
          return (
            <li key={v.version} className={active ? 'active' : ''}>
              <button onClick={() => onSelect(v)}>
                <span className="vtag">{v.version}{v.is_latest && <em className="latest">latest</em>}</span>
                <span className={`st st-${v.status}`}>{v.status}</span>
                <span className="ts">{(v.created_at || '').slice(5, 16).replace('T', ' ')}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
