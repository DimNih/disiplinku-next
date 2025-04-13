"use client"

import { useState, useEffect } from "react"
import { translations } from "@/lib/translations"
import { ImageIcon, Calendar, Info, User, Upload, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageData {
  id: string
  url: string
  firebaseUrl?: string
  originalFilename?: string
  uploadedBy?: string
  createdAt: number
  scanned?: boolean
}

interface ImagesSectionProps {
  language: string
  setImagePopupSrc: (src: string) => void
}

export default function ImagesSection({ language, setImagePopupSrc }: ImagesSectionProps) {
  const [images, setImages] = useState<ImageData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState("")
  const [uploadInfo, setUploadInfo] = useState({ visible: false })
  const [scanResult, setScanResult] = useState<{ scanned: number; added: number } | null>(null)

  const t = translations[language as keyof typeof translations] || translations.id

  useEffect(() => {
    loadImages()
  }, [])

  const loadImages = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/images")
      if (!response.ok) throw new Error("Failed to fetch images")

      const data = await response.json()
      setImages(data)
    } catch (error) {
      console.error("Error loading images:", error)
      setError("Gagal memuat daftar gambar")
    } finally {
      setIsLoading(false)
    }
  }

  const scanImages = async () => {
    setIsScanning(true)
    setScanResult(null)

    try {
      const response = await fetch("/api/scan-images")
      if (!response.ok) throw new Error("Failed to scan images")

      const data = await response.json()
      if (data.success) {
        setScanResult({
          scanned: data.scanned,
          added: data.added,
        })
        // Reload images to show newly scanned ones
        loadImages()
      } else {
        throw new Error(data.error || "Failed to scan images")
      }
    } catch (error) {
      console.error("Error scanning images:", error)
      setError("Gagal memindai gambar")
    } finally {
      setIsScanning(false)
    }
  }

  const toggleUploadInfo = () => {
    setUploadInfo((prev) => ({ ...prev, visible: !prev.visible }))
  }

  return (
    <div id="images" className="section">
      <h2 className="text-2xl font-semibold text-blue-600 mb-6 text-center flex items-center justify-center">
        <i className="material-icons mr-2 text-orange-400">image</i>
        {t["image-post"]}
      </h2>

      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <h3 className="text-lg font-medium">Daftar Gambar</h3>
        <div className="flex gap-2">
          <Button onClick={scanImages} disabled={isScanning} variant="outline" className="flex items-center gap-2">
            {isScanning ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Scan Image Folder
              </>
            )}
          </Button>
          <Button onClick={toggleUploadInfo} className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            API Upload Info
          </Button>
        </div>
      </div>

      {scanResult && (
        <div className="mb-6 p-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded-lg">
          <p className="font-medium">
            Scan complete! Found {scanResult.scanned} images, added {scanResult.added} new ones to the data file.
          </p>
        </div>
      )}

      {uploadInfo.visible && (
        <div className="bg-card p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-medium mb-4">Upload Image API</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">Endpoint:</h4>
              <code className="bg-muted p-2 rounded block mt-1">{window.location.origin}/api/uploadImage</code>
            </div>
            <div>
              <h4 className="font-medium">Method:</h4>
              <code className="bg-muted p-2 rounded block mt-1">POST</code>
            </div>
            <div>
              <h4 className="font-medium">Headers:</h4>
              <code className="bg-muted p-2 rounded block mt-1">x-api-key: YOUR_API_KEY</code>
            </div>
            <div>
              <h4 className="font-medium">Body (form-data):</h4>
              <code className="bg-muted p-2 rounded block mt-1">image: [file]</code>
            </div>
            <div>
              <h4 className="font-medium">Example cURL:</h4>
              <code className="bg-muted p-2 rounded block mt-1 text-xs overflow-x-auto whitespace-pre">
                {`curl -X POST \\
  ${window.location.origin}/api/uploadImage \\
  -H "x-api-key: YOUR_API_KEY" \\
  -F "image=@/path/to/your/image.jpg"`}
              </code>
            </div>
            <div>
              <h4 className="font-medium">Alternative (Query Parameter):</h4>
              <code className="bg-muted p-2 rounded block mt-1 text-xs overflow-x-auto whitespace-pre">
                {`curl -X POST \\
  "${window.location.origin}/api/uploadImage?api_key=YOUR_API_KEY" \\
  -F "image=@/path/to/your/image.jpg"`}
              </code>
            </div>
          </div>
        </div>
      )}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.length > 0 ? (
            images.map((image, index) => (
              <div
                key={image.id || index}
                className="bg-card rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={image.url || "/placeholder.svg"}
                    alt={image.originalFilename || `Uploaded Image ${index + 1}`}
                    onClick={() => setImagePopupSrc(image.url)}
                    className="w-full h-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <h3
                    className="font-medium text-foreground flex items-center mb-2 truncate"
                    title={image.originalFilename || `Gambar ${index + 1}`}
                  >
                    <ImageIcon className="h-4 w-4 mr-2 text-orange-400 flex-shrink-0" />
                    {image.originalFilename || `Gambar ${index + 1}`}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-orange-400 flex-shrink-0" />
                    {new Date(image.createdAt).toLocaleDateString()}
                  </p>
                  {image.uploadedBy && (
                    <p className="text-sm text-muted-foreground flex items-center mt-1">
                      <User className="h-4 w-4 mr-2 text-orange-400 flex-shrink-0" />
                      Admin ID: {image.uploadedBy}
                    </p>
                  )}
                  {image.scanned && (
                    <p className="text-xs text-blue-500 mt-1">
                      <i className="material-icons text-xs mr-1 align-text-bottom">search</i>
                      Found by folder scan
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-8 bg-card rounded-lg">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">Belum ada gambar yang diunggah.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
