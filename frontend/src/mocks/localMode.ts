/** 本地模拟必须显式开启；默认始终走真实 /api/v1。 */
export const apiMode = import.meta.env.VITE_API_MODE ?? 'remote'
export const useLocalMock = apiMode === 'mock'
