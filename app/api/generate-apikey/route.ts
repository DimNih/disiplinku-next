import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { ref, push, set } from "firebase/database"
import crypto from "crypto"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.email

    // Generate a unique API key that includes the user ID
    const randomBytes = crypto.randomBytes(12).toString("hex")
    const userPrefix = userId.substring(0, 4)
    const apiKey = `${userPrefix}_${randomBytes}`

    const timestamp = Date.now()

    // Save API key to admin's record
    const adminApiKeyRef = ref(db, `admin-dashboard/admin/${userId}/apikeys`)
    const newApiKeyRef = push(adminApiKeyRef)
    await set(newApiKeyRef, {
      key: apiKey,
      userId: userId,
      createdAt: timestamp,
    })

    // Save API key to global API keys collection
    const apiKeysRef = ref(db, `api-keys/${apiKey}`)
    await set(apiKeysRef, {
      userId: userId,
      createdAt: timestamp,
    })

    return NextResponse.json({ success: true, apikey: apiKey })
  } catch (error) {
    console.error("Error generating API key:", error)
    return NextResponse.json({ error: "Gagal menghasilkan API Key" }, { status: 500 })
  }
}
