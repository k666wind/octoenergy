import type { AppConfig, ExportData, Credentials, TariffConfig } from '../types'

const EXPORT_VERSION = '2.0'

export function exportConfig(config: AppConfig): void {
  const data: ExportData = {
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    credentials: config.credentials,
    tariff: config.tariff,
  }
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `octoenergy-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importConfig(file: File): Promise<{ credentials: Credentials; tariff: TariffConfig }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string
        const data = JSON.parse(raw) as ExportData
        if (!data.exportVersion || !data.credentials || !data.tariff) {
          reject(new Error('Invalid config file'))
          return
        }
        if (!data.credentials.apiKey || !data.credentials.accountNumber) {
          reject(new Error('Missing API credentials'))
          return
        }
        if (!data.credentials.electricity?.mpan || !data.credentials.electricity?.serialNumber) {
          reject(new Error('Missing electricity meter details'))
          return
        }
        // Migrate v1.0 backups — ensure new fields exist
        const rawCreds = data.credentials as any
        const rawTariff = data.tariff as any
        if (!('outgoing' in rawCreds)) rawCreds.outgoing = null
        if (!('outgoingType' in rawTariff)) {
          rawTariff.outgoingType = 'fixed'
          rawTariff.outgoingFixedRate = 0
        }
        resolve({ credentials: data.credentials, tariff: data.tariff })
      } catch {
        reject(new Error('Failed to parse config file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
