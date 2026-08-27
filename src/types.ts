export interface HistoryRecord {
  id: number
  moduleName: string
  appName: string
  content: string
  operationTime: number
  status: 'success' | 'error' | 'running' | string
  contentType?: string
  createTime?: string
}
