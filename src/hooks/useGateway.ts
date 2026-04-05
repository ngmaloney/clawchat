import { useCallback, useEffect, useRef, useState } from 'react'
import { GatewayClient } from '../lib/gateway-client'
import type { BackendType } from '../lib/gateway-client'
import type { ConnectionStatus } from '../types/protocol'

export type { ConnectionStatus }

interface UseGatewayOptions {
  url: string
  token: string
  backend?: BackendType
  deviceToken?: string
  autoConnect?: boolean
}

export interface GatewayHandle {
  status: ConnectionStatus
  client: GatewayClient | null
  connect: () => void
  disconnect: () => void
}

export function useGateway({ url, token, backend, deviceToken, autoConnect = false }: UseGatewayOptions): GatewayHandle {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [client, setClient] = useState<GatewayClient | null>(null)
  // Internal ref for callbacks that need stable access without re-subscribing
  const clientRef = useRef<GatewayClient | null>(null)

  // Create / recreate the client when url or token change
  useEffect(() => {
    if (!url || (!token && backend !== 'channel')) return

    const newClient = new GatewayClient({
      url,
      token,
      backend,
      deviceToken,
      onStatusChange: (s) => setStatus(s),
      onDeviceToken: (dt) => {
        window.api.store.set('deviceToken', dt)
      },
    })

    clientRef.current = newClient
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(newClient)

    if (autoConnect) {
      newClient.connect()
    }

    return () => {
      newClient.disconnect()
      clientRef.current = null
      setClient(null)
    }
  }, [url, token, backend, deviceToken, autoConnect])

  const connect = useCallback(() => {
    clientRef.current?.connect()
  }, [])

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect()
    setStatus('disconnected')
  }, [])

  return {
    status,
    client,
    connect,
    disconnect,
  }
}
