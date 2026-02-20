import { useCallback, useEffect, useState } from 'react'
import type { GatewayClient } from '../lib/gateway-client'
import type { ConnectionStatus } from '../types/protocol'

export interface ModelInfo {
  id: string
  name?: string
  provider?: string
  [key: string]: unknown
}

export interface AgentInfo {
  id: string
  name?: string
  [key: string]: unknown
}

export interface GatewayConfig {
  thinkingLevel?: string
  [key: string]: unknown
}

export interface GatewayCapabilities {
  models: ModelInfo[]
  agents: AgentInfo[]
  config: GatewayConfig
  loading: boolean
  refresh: () => Promise<void>
}

export function useGatewayCapabilities(
  client: GatewayClient | null,
  status: ConnectionStatus,
): GatewayCapabilities {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [config, setConfig] = useState<GatewayConfig>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!client || status !== 'connected') return
    setLoading(true)
    try {
      const [modelsRes, agentsRes, configRes] = await Promise.allSettled([
        client.call('models.list', {}),
        client.call('agents.list', {}),
        client.call('config.get', {}),
      ])

      if (modelsRes.status === 'fulfilled') {
        const res = modelsRes.value as { models?: ModelInfo[] }
        setModels(res.models ?? [])
      }
      if (agentsRes.status === 'fulfilled') {
        const res = agentsRes.value as { agents?: AgentInfo[] }
        setAgents(res.agents ?? [])
      }
      if (configRes.status === 'fulfilled') {
        setConfig(configRes.value as GatewayConfig)
      }
    } catch (err) {
      console.error('[useGatewayCapabilities] Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [client, status])

  useEffect(() => {
    if (status === 'connected') {
      void refresh()
    } else if (status === 'disconnected') {
      setModels([])
      setAgents([])
      setConfig({})
    }
  }, [status, refresh])

  return { models, agents, config, loading, refresh }
}
