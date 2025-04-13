import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { ref, get } from "firebase/database"
import { promises as fs } from "fs"
import path from "path"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch images from Firebase
    const imagesRef = ref(db, "images")
    const snapshot = await get(imagesRef)

    let imageUrls: any[] = []

    if (snapshot.exists()) {
      const imagesData = snapshot.val()

      // Transform the data to include full URLs and convert to array
      imageUrls = Object.keys(imagesData).map((key) => ({
        id: key,
        url: imagesData[key].url,
        firebaseUrl: imagesData[key].firebaseUrl,
        originalFilename: imagesData[key].originalFilename,
        uploadedBy: imagesData[key].uploadedBy,
        createdAt: imagesData[key].createdAt || Date.now(),
        fromDatabase: true,
      }))
    }

    // Also check the image-data folder for any files not in the database
    try {
      const imageDir = path.join(process.cwd(), "public", "image-data")

      // Check if directory exists
      await fs.access(imageDir)

      // Read all files in the directory
      const files = await fs.readdir(imageDir)

      // Filter for image files
      const imageFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase()
        return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"].includes(ext)
      })

      // Create a set of existing URLs from the database
      const existingUrls = new Set(imageUrls.map((img) => img.url))

      // Add files that aren't in the database
      for (const file of imageFiles) {
        const imageUrl = `/image-data/${file}`

        // Skip if already in the results
        if (existingUrls.has(imageUrl)) {
          continue
        }

        // Get file stats for creation time
        const stats = await fs.stat(path.join(imageDir, file))

        // Add to results
        imageUrls.push({
          id: `file-${file}`,
          url: imageUrl,
          originalFilename: file,
          createdAt: stats.birthtime.getTime(),
          fromFolder: true,
        })
      }
    } catch (error) {
      console.error("Error reading image directory:", error)
      // Continue even if there's an error reading the directory
    }

    // Sort by createdAt in descending order (newest first)
    imageUrls.sort((a, b) => b.createdAt - a.createdAt)

    return NextResponse.json(imageUrls)
  } catch (error) {
    console.error("Error fetching images:", error)
    return NextResponse.json({ error: "Gagal memuat gambar" }, { status: 500 })
  }
}
