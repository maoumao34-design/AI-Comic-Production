import type { StepVersion } from '../../types'
import { STEP_LABELS } from '../../types'
import { ArtifactGallery } from '../ArtifactGallery'

/** 兜底通用渲染：产物预览 + 参数/seed/参考图 */
export function GenericStepView({ version }: { version: StepVersion }) {
  const c = version.content as { note?: string; pending_schema?: boolean }
  return (
    <div className="step-generic">
      {c?.pending_schema && (
        <div className="callout info">
          {STEP_LABELS[version.step]} 的 content schema 由该步 owner 定稿中；先按通用外壳展示产物 / 参数 / 版本，schema 到位后切到专用视图。
        </div>
      )}
      {c?.note && <p className="muted">{c.note}</p>}

      <h4>产物（artifacts）</h4>
      <ArtifactGallery artifacts={version.artifacts} />

      <h4>参数 / 模型</h4>
      <div className="kv">
        <div><span className="k">model</span><span className="v">{version.model ?? '—'}</span></div>
        <div><span className="k">seed</span><span className="v">{version.seed ?? '—'}</span></div>
        <div><span className="k">归档</span><span className="v mono">{version.archive_path}</span></div>
        {version.refs && version.refs.length > 0 && (
          <div><span className="k">refs</span><span className="v mono">{version.refs.join(' ')}</span></div>
        )}
        {version.params && Object.keys(version.params).length > 0 && (
          <div><span className="k">params</span><span className="v mono">{JSON.stringify(version.params)}</span></div>
        )}
      </div>
    </div>
  )
}
