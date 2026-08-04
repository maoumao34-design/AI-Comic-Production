import type { StepVersion } from '../types'
import { Script01View } from './steps/Script01View'
import { Storyboard02View } from './steps/Storyboard02View'
import { Assets03View } from './steps/Assets03View'
import { Keyframes04View } from './steps/Keyframes04View'
import { Segments05View } from './steps/Segments05View'
import { GenericStepView } from './steps/GenericStepView'

/** 按步骤类型 switch 渲染该步 schema 产物（PER-STEP-UI-SPEC §4） */
export function StepContent({ version }: { version: StepVersion }) {
  switch (version.step) {
    case '01':
      return <Script01View version={version} />
    case '02':
      return <Storyboard02View version={version} />
    case '03':
      return <Assets03View version={version} />
    case '04':
      return <Keyframes04View version={version} />
    case '05':
      return <Segments05View version={version} />
    default:
      return <GenericStepView version={version} />
  }
}
