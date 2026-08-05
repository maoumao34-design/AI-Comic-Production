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
  const sorted = [...versions].sort((a, b) => (a.version < b.version ? 1 : -1))
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
      <div className="vb-head">版本归档（{versions.length}）</div>
      {sorted.length === 0 && <div className="empty">该步暂无版本</div>}
      <ul>
        {sorted.map((v) => {
          const isPreview = viewing?.version === v.version
          const isReview = current?.version === v.version
          return (
            <li key={v.version} className={isPreview ? 'active' : ''}>
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
