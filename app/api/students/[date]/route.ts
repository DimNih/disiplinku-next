import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { ref, get } from "firebase/database"

export async function GET(request: Request, { params }: { params: { date: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Make sure params.date is a string
    const date = params.date as string

    if (!date) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }

    const pelanggaranRef = ref(db, `pelanggaran/${date}`)
    const snapshot = await get(pelanggaranRef)
    const data = snapshot.val() || {}
    const students = Object.values(data)

    return NextResponse.json(students)
  } catch (error) {
    console.error("Error fetching students:", error)
    return NextResponse.json({ error: "Gagal memuat data siswa" }, { status: 500 })
  }
}
