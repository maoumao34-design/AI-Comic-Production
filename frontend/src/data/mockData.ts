import type { Episode, StepVersion, StepId } from '../types'

/** 占位产物 URL（mock；真实产物走后端 /artifacts?path=） */
const P = (label: string, path: string): { type: 'image' | 'video' | 'audio' | 'text'; url: string; label: string } => ({
  type: path.endsWith('.mp4') ? 'video' : path.endsWith('.wav') || path.endsWith('.mp3') ? 'audio' : path.endsWith('.txt') || path.endsWith('.md') ? 'text' : 'image',
  url: `/mock${path}`,
  label,
})

export const SEED_EPISODES: Episode[] = [
  {
    episode_id: 'EP-01',
    title: '第1集 · Serena 身份暴露起点',
    status: 'in_progress',
    current_step: '02',
    created_at: '2026-07-31T16:00:00Z',
    updated_at: '2026-07-31T17:05:00Z',
  },
  {
    episode_id: 'EP-02',
    title: '第2集 · 暗流涌动',
    status: 'draft',
    current_step: '01',
    created_at: '2026-07-31T16:05:00Z',
    updated_at: '2026-07-31T16:05:00Z',
  },
]

/** EP-01 的各步版本（mock 归档）。01 已通过；02 正在 awaiting_review。 */
export const SEED_VERSIONS: Record<StepId, StepVersion[]> = {
  '01': [
    {
      episode_id: 'EP-01', step: '01', version: 'v1', is_latest: true, status: 'approved',
      model: 'claude-sonnet', seed: 101,
      params: { temperature: 0.7, narration_language: 'zh' },
      artifacts: [P('解说词 v1', '/assets/EP-01/01-script/v1/narration.md')],
      archive_path: 'assets/EP-01/01-script/v1/',
      content: {
        step: '01-script', episode: 'EP-01', version: 'v1', date: '2026-08-01',
        narration_language: 'zh',
        one_line_premise: 'Serena 隐藏的豪门身份第一次露出破绽。',
        emotion_arc: { opening: '平静', rising: '警觉', turning: '震动', closing: '隐忍' },
        est_duration_sec: 95, word_count: 360,
        word_count_target: { min: 210, max: 480, chars_per_sec: '3.5–4' },
        beats_count: 3, retained_dialogues_count: 2,
        source: { primary: 'english_docx', reference: 'chinese_docx', primary_title: 'Ep1', reference_title: '第1集' },
        adaptation: { boundary_confirmed: false, policy: '保守：仅必要口语化，不改情节/不删关键对白', changes: [] },
        open_specs: ['narration_language', 'duration', 'aspect_ratio', 'adaptation_boundary'],
        beats: [
          { beat_id: 'b1', scene_label: '开场·晚宴', narration_text: '在这场衣香鬓影的晚宴上，没人知道那个安静端着酒杯的女人，姓的正是这座大厦的主人。', preserved_dialogue: [{ text: "You really don't know who I am, do you?", character: 'Serena' }], emotion: '平静中藏锋', visual_hint: 'Serena 端杯 / James 漫不经心 / 晚宴厅 / 桌上一张被忽略的请柬' },
          { beat_id: 'b2', scene_label: '破绽', narration_text: '直到那封请柬滑落桌面，所有人的目光，第一次真正落在她身上。', preserved_dialogue: [], emotion: '震动', visual_hint: '请柬特写 / 周围宾客侧目 / Serena 神情微变' },
          { beat_id: 'b3', scene_label: '收束', narration_text: '她没有解释，只是把那杯酒一饮而尽——这是她留给这场宴会，最后的体面。', preserved_dialogue: [{ text: 'Enjoy your evening.', character: 'Serena' }], emotion: '隐忍', visual_hint: '空酒杯 / 转身离场 / 背影 / 门外的夜色' },
        ],
      },
      created_at: '2026-07-31T16:20:00Z', duration_ms: 4200, failure: null,
    },
  ],
  '02': [
    {
      episode_id: 'EP-01', step: '02', version: 'v1', is_latest: false, status: 'awaiting_review',
      model: 'claude-sonnet', seed: 202,
      params: { source_narration_version: 'v1' },
      artifacts: [P('分镜表 v1', '/assets/EP-01/02-storyboard/v1/storyboard.md')],
      refs: ['/assets/EP-01/01-script/latest/narration.md'],
      archive_path: 'assets/EP-01/02-storyboard/v1/',
      content: {
        step: '02-storyboard', episode: 'EP-01', version: 'v1', date: '2026-08-01',
        source_narration: { episode: 'EP-01', version: 'v1' },
        shots_count: 4, est_total_duration_sec: 95, open_specs: ['aspect_ratio'],
        shots: [
          { shot_id: 's1', linked_beat_id: 'b1', shot_no: 'S1', characters: ['Serena', 'James'], action: 'Serena 端起酒杯，目光掠过 James', scene: '高档晚宴厅', evidence_visual: '桌上被 James 忽略的豪门请柬特写', shot_type: '中景', duration_sec: 6, ref_image_slot: null, notes: '首镜；字幕安全区留底部' },
          { shot_id: 's2', linked_beat_id: 'b2', shot_no: 'S2', characters: ['Serena', '宾客'], action: '请柬滑落桌面，宾客侧目', scene: '晚宴厅长桌', evidence_visual: '请柬特写 + 周围侧目的脸', shot_type: '近景', duration_sec: 5, ref_image_slot: null, notes: '关键转折镜' },
          { shot_id: 's3', linked_beat_id: 'b2', shot_no: 'S3', characters: ['Serena'], action: 'Serena 神情微变后迅速恢复', scene: '晚宴厅', evidence_visual: 'Serena 眼神特写', shot_type: '特写', duration_sec: 4, ref_image_slot: null, notes: '情绪镜' },
          { shot_id: 's4', linked_beat_id: 'b3', shot_no: 'S4', characters: ['Serena'], action: '一饮而尽，转身离场', scene: '晚宴厅门口', evidence_visual: '空酒杯 + 离场背影 + 门外夜色', shot_type: '全景', duration_sec: 7, ref_image_slot: null, notes: '收束镜' },
        ],
      },
      created_at: '2026-07-31T17:00:00Z', duration_ms: 5600, failure: null,
    },
  ],
  '03': [],
  '04': [],
  '05': [],
  '06': [],
  '07': [],
}

/** 步骤归档目录名（对齐 PIPELINE assets/ 约定） */
export const STEP_ARCHIVE_DIR: Record<StepId, string> = {
  '01': '01-script',
  '02': '02-storyboard',
  '03': '03-assets',
  '04': '04-keyframes',
  '05': '05-clips',
  '06': '06-voice-sub',
  '07': '07-final',
}

/** 给 mock 推进/重生用的逐步 schema 占位 content */
export function placeholderContent(episodeId: string, step: StepId): unknown {
  switch (step) {
    case '01':
      return { ...(SEED_VERSIONS['01'][0].content as object), one_line_premise: '（草稿）Serena 身份暴露起点' }
    case '02':
      return { ...(SEED_VERSIONS['02'][0].content as object) }
    case '03':
      return {
        step: '03-assets', episode: episodeId, version: 'v1',
        subjects: [
          {
            subject_type: 'character', subject_id: 'serena', label: 'Serena', status: 'draft',
            views: {
              front: `/mock/assets/${episodeId}/03-assets/v1/outputs/serena/front.png`,
              side: `/mock/assets/${episodeId}/03-assets/v1/outputs/serena/side.png`,
              back: `/mock/assets/${episodeId}/03-assets/v1/outputs/serena/back.png`,
            },
            consistency_check: { passed: true, issues: [] },
            prompt: 'Serena, elegant dinner look, three-view character sheet, consistent face',
          },
          {
            subject_type: 'scene', subject_id: 'banquet_hall', label: '高档晚宴厅', status: 'draft',
            output: { url: `/mock/assets/${episodeId}/03-assets/v1/outputs/banquet_hall/hero.png`, type: 'image' },
            consistency_check: { passed: true, issues: [] },
          },
          {
            subject_type: 'prop', subject_id: 'invitation', label: '豪门请柬', status: 'draft',
            output: { url: `/mock/assets/${episodeId}/03-assets/v1/outputs/invitation/closeup.png`, type: 'image' },
            consistency_check: { passed: true, issues: [] },
          },
        ],
      }
    case '04':
      return {
        step: '04-keyframes', episode: episodeId, version: 'v1',
        keyframes: [
          { kf_id: 'kf1', source_shot_id: 's1', shot: { 景别: '中景', angle: 'eye-level', composition: 'Serena 端杯' }, asset_refs: ['serena', 'banquet_hall'], characters_in_frame: ['Serena', 'James'], output: { url: `/mock/assets/${episodeId}/04-keyframes/v1/outputs/kf1.png`, type: 'image' }, prompt: 'Serena holding wine glass at banquet' },
          { kf_id: 'kf2', source_shot_id: 's2', shot: { 景别: '近景', angle: 'high', composition: '请柬滑落' }, asset_refs: ['invitation', 'serena'], characters_in_frame: ['Serena'], output: { url: `/mock/assets/${episodeId}/04-keyframes/v1/outputs/kf2.png`, type: 'image' }, prompt: 'invitation card sliding onto table' },
          { kf_id: 'kf3', source_shot_id: 's4', shot: { 景别: '全景', angle: 'eye-level', composition: '离场背影' }, asset_refs: ['serena', 'banquet_hall'], characters_in_frame: ['Serena'], output: { url: `/mock/assets/${episodeId}/04-keyframes/v1/outputs/kf3.png`, type: 'image' }, prompt: 'Serena exiting banquet hall silhouette' },
        ],
      }
    case '05':
      return {
        step: '05-segments', episode: episodeId, version: 'v1',
        provider: 'unset',
        segments: [
          {
            seg_id: 'seg1', duration_s: 6,
            keyframe_refs: { first: 'kf1', last: 'kf2' },
            prompt: { shot: '中景→近景', action: 'Serena 端杯，请柬滑落', dialogue: '', emotion: '平静中藏锋', sfx: 'glass clink, murmur' },
            selection: { decision: 'pending', reason: '' },
            output: { url: `/mock/assets/${episodeId}/05-clips/v1/outputs/seg1.mp4`, type: 'video' },
          },
          {
            seg_id: 'seg2', duration_s: 7,
            keyframe_refs: { first: 'kf2', last: 'kf3' },
            prompt: { shot: '近景→全景', action: '一饮而尽离场', dialogue: 'Enjoy your evening.', emotion: '隐忍', sfx: 'footsteps, door' },
            selection: { decision: 'pending', reason: '' },
            output: { url: `/mock/assets/${episodeId}/05-clips/v1/outputs/seg2.mp4`, type: 'video' },
          },
        ],
        note: '多平台候选未锁定（Seedance/Kling/Wan/Comfy）——先讨论再定 provider。',
      }
    case '06':
      return {
        voiceover: {
          tts: 'elevenlabs',
          model: 'eleven_multilingual_v2',
          voice_id: '<pending>',
          language: 'en',
          speed: 1.0,
          audio: { url: `assets/${episodeId}/06-voice-sub/v1/output_voiceover.mp3`, duration_ms: 95000 },
        },
        subtitle_track: {
          format: 'srt',
          language: 'en',
          burn_in: true,
          file_url: `assets/${episodeId}/06-voice-sub/v1/output_subs.srt`,
          cues: [
            { index: 1, start_ms: 0, end_ms: 6000, text: 'At the glittering banquet, no one knew who she really was.' },
            { index: 2, start_ms: 6000, end_ms: 11000, text: 'Until the invitation slipped onto the table.' },
          ],
        },
        script_ref: `assets/${episodeId}/01-script/latest/`,
        clips_ref: `assets/${episodeId}/05-clips/latest/`,
      }
    case '07':
      return {
        cut: {
          duration_ms: 95000,
          aspect: '9:16',
          resolution: [1080, 1920],
          fps: 30,
          video: { url: `assets/${episodeId}/07-final/v1/output_final.mp4`, container: 'mp4', vcodec: 'h264', acodec: 'aac' },
        },
        tracks: {
          voiceover_ref: `assets/${episodeId}/06-voice-sub/latest/`,
          clips_ref: `assets/${episodeId}/05-clips/latest/`,
          music: [{ url: '', label: 'BGM', gain_db: -18 }],
          sfx: [],
        },
        subtitle: { burn_in: true, language: 'en' },
        edit_project: { tool: 'ffmpeg', project_file_url: `assets/${episodeId}/07-final/v1/edit_project.json` },
        delivery_spec_id: '<pending>',
      }
    default:
      return { note: `${step} 占位`, pending_schema: true }
  }
}

/** 给"重生/修改"产生的新版本占位内容 */
export function draftVersionContent(step: StepId, episodeId = 'EP-01'): unknown {
  if (step === '01') {
    return { ...(SEED_VERSIONS['01'][0].content as object), beats_count: 3, one_line_premise: '（重生草稿）Serena 身份暴露起点 · 换参重跑版本' }
  }
  const base = placeholderContent(episodeId, step) as Record<string, unknown>
  return { ...base, note: `${step} 重生草稿（占位产物）` }
}
