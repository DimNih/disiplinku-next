import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { ref, get } from "firebase/database"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Only fetch API keys for the current user
    const apiKeysRef = ref(db, `admin-dashboard/admin/${userId}/apikeys`)
    const snapshot = await get(apiKeysRef)
    const apikeys = snapshot.val() || {}

    const apikeyList = Object.entries(apikeys).map(([keyId, keyData]: [string, any]) => ({
      id: keyId,
      key: keyData.key,
      createdAt: keyData.createdAt,
    }))

    return NextResponse.json({ success: true, apikeys: apikeyList })
  } catch (error) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json({ error: "Gagal memuat API keys" }, { status: 500 })
  }
}
