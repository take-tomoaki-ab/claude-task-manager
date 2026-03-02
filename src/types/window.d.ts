import type { WindowApi } from './ipc'

declare global {
  interface Window {
    api: WindowApi
  }
}
