"use client"

import { useState, useEffect } from "react"
import { translations } from "@/lib/translations"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Key, Calendar, CheckCircle, Eye, EyeOff, Copy, AlertCircle } from "lucide-react"
import { useToast } from "@/contexts/toast-context"

interface ApiKeySectionProps {
  language: string
}

export default function ApiKeySection({ language }: ApiKeySectionProps) {
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [newApiKey, setNewApiKey] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const { showToast } = useToast()

  const t = translations[language as keyof typeof translations] || translations.id

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/apikeys")
      if (!response.ok) throw new Error("Failed to fetch API keys")

      const data = await response.json()
      if (data.success) {
        setApiKeys(data.apikeys)
      } else {
        throw new Error(data.error || "Failed to load API keys")
      }
    } catch (error) {
      console.error("Error loading API keys:", error)
      setError("Gagal memuat API keys")
    } finally {
      setIsLoading(false)
    }
  }

  const generateApiKey = async () => {
    setIsLoading(true)
    setError("")
    setNewApiKey("")

    try {
      const response = await fetch("/api/generate-apikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("Failed to generate API key")

      const data = await response.json()
      if (data.success) {
        setNewApiKey(data.apikey)
        loadApiKeys() // Refresh the list
        showToast(t["success"], t["api-key-generated"], "success")
      } else {
        throw new Error(data.error || "Failed to generate API key")
      }
    } catch (error) {
      console.error("Error generating API key:", error)
      setError("Gagal menghasilkan API Key")
      showToast(t["error"], t["api-key-generation-failed"], "error")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => ({
      ...prev,
      [keyId]: !prev[keyId],
    }))
  }

  const copyToClipboard = (key: string, keyId: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(keyId)
    showToast(t["success"], t["api-key-copied"], "success")

    // Reset copied status after 2 seconds
    setTimeout(() => {
      setCopiedKey(null)
    }, 2000)
  }

  const columns = [
    {
      key: "index",
      header: "#",
      cell: (_: any, index: number) => index + 1,
    },
    {
      key: "key",
      header: (
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4" /> {t["api-key"]}
        </div>
      ),
      cell: (keyData: any) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs sm:text-sm break-all">
            {visibleKeys[keyData.id] ? keyData.key : `${keyData.key.slice(0, 8)}****${keyData.key.slice(-8)}`}
          </span>
          <div className="flex gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleKeyVisibility(keyData.id)}
              className="h-7 w-7 p-0"
              title={visibleKeys[keyData.id] ? t["hide-key"] : t["show-key"]}
            >
              {visibleKeys[keyData.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(keyData.key, keyData.id)}
              className="h-7 w-7 p-0"
              title={t["copy-key"]}
            >
              {copiedKey === keyData.id ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" /> {t["created-at"]}
        </div>
      ),
      cell: (keyData: any) => new Date(keyData.createdAt).toLocaleString(),
      sortable: true,
    },
    {
      key: "status",
      header: t["status"],
      cell: () => (
        <span className="text-green-500 flex items-center">
          <CheckCircle className="h-4 w-4 mr-1" />
          {t["active"]}
        </span>
      ),
    },
  ]

  return (
    <div id="apikey" className="section">
      <h2 className="text-2xl font-semibold text-blue-600 mb-6 text-center flex items-center justify-center">
        <i className="material-icons mr-2 text-orange-400">vpn_key</i>
        {t["api-key"]}
      </h2>

      <div className="bg-card p-4 sm:p-6 rounded-xl shadow-md mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium mb-2">{t["generate-api-key"]}</h3>
            <p className="text-muted-foreground text-sm mb-4 md:mb-0">{t["generate-api-key-description"]}</p>
          </div>
          <Button onClick={generateApiKey} disabled={isLoading} className="flex items-center gap-2 whitespace-nowrap">
            <Key className="h-4 w-4" />
            {isLoading ? t["generating"] : t["generate-api-key-btn"]}
          </Button>
        </div>

        {newApiKey && (
          <div className="mt-4 p-4 border rounded-lg bg-muted">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-medium">{t["api-key"]}:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(newApiKey)
                    showToast(t["success"], t["api-key-copied"], "success")
                  }}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {t["copy"]}
                </Button>
              </div>
              <code className="p-2 bg-background rounded font-mono text-sm break-all">{newApiKey}</code>
              <p className="text-red-500 text-sm flex items-center mt-2">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                {t["api-key-warning"]}
              </p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
          <i className="material-icons mr-2 text-orange-400">history</i>
          {t["api-key-history"]}
        </h3>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-red-500 flex items-center justify-center">
            <i className="material-icons mr-2 text-sm">error</i>
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable data={apiKeys} columns={columns} emptyMessage={t["no-api-keys"]} />
          </div>
        )}
      </div>
    </div>
  )
}
