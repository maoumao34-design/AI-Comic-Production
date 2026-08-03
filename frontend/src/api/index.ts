import type { ComicApi } from './types'
import { mockApi } from './mock'
import { realApi } from './client'

// 后端未就绪：默认 mock。后端就绪后设 VITE_USE_MOCK=false + VITE_API_BASE=https://host/api/v1。
const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api/v1'

export const api: ComicApi = USE_MOCK ? mockApi : realApi(API_BASE)
export const USING_MOCK = USE_MOCK
