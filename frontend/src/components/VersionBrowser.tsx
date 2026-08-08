import type { StepVersion } from '../types'

/** 版本列表：点击预览（本地）；「选用此版」写审阅指针（SELECT-VERSION-CONTRACT §4.1） */
export function VersionBrowser({
  versions,
  current,
  preview,
  onPreview,
  onSelectVersion,
  busy,
}: {
  versions: StepVersion[]
  /** 当前审阅版（GET .../current） */
  current?: StepVersion
  /** 本地预览；null = 跟审阅版 */
  preview?: StepVersion | null
  onPreview: (v: StepVersion) => void
  onSelectVersion?: (v: StepVersion) => void
  busy?: boolean
}) {
  // 同名 vN 去重（后端曾用数组长度发号导致两个 v3；点一个会一起亮）
  const byVer = new Map<string, StepVersion>()
  for (const v of versions) byVer.set(v.version, v)
  const sorted = [...byVer.values()].sort((a, b) => {
    const na = Number(String(a.version).replace(/^v/i, '')) || 0
    const nb = Number(String(b.version).replace(/^v/i, '')) || 0
    return nb - na
  })
  const viewing = preview ?? current
  const canSelect =
    !!onSelectVersion &&
    !!viewing &&
    !!current &&
    viewing.version !== current.version &&
    current.status === 'awaiting_review' &&
    !busy

  return (
    <div className="version-browser">
      <div className="vb-head">版本归档（{sorted.length}）</div>
      {sorted.length === 0 && <div className="empty">该步暂无版本</div>}
      <ul>
        {sorted.map((v) => {
          const isPreview = viewing?.version === v.version
          const isReview = current?.version === v.version
          return (
            <li key={`${v.version}:${v.archive_path || ''}`} className={isPreview ? 'active' : ''}>
              <button type="button" onClick={() => onPreview(v)}>
                <span className="vtag">
                  {v.version}
                  {isReview && <em className="reviewing">审阅</em>}
                  {v.is_latest && <em className="latest">latest</em>}
                </span>
                <span className={`st st-${v.status}`}>{v.status}</span>
                <span className="ts">{(v.created_at || '').slice(5, 16).replace('T', ' ')}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {viewing && viewing.version !== current?.version && (
        <div className="vb-actions">
          <button
            type="button"
            className="btn primary"
            disabled={!canSelect}
            title={
              busy
                ? '忙碌中'
                : current?.status !== 'awaiting_review'
                  ? '仅 awaiting_review 可选用'
                  : viewing.version === current?.version
                    ? '已是当前审阅版'
                    : '把该版设为当前审阅版'
            }
            onClick={() => viewing && onSelectVersion?.(viewing)}
          >
            选用此版
          </button>
        </div>
      )}
    </div>
  )
}
