"use client"

import { useState, useEffect, useRef } from "react"
import { Chart, registerables } from "chart.js"
import { translations } from "@/lib/translations"
import { db } from "@/lib/firebase"
import { ref, get } from "firebase/database"

// Register Chart.js components
Chart.register(...registerables)

interface HomeProps {
  language: string
}

export default function HomeSection({ language }: HomeProps) {
  const [stats, setStats] = useState({
    osisOnline: 0,
    totalPelanggar: 0,
    totalSiswa: 0,
  })
  const [violationData, setViolationData] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  })
  const [classData, setClassData] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const violationChartRef = useRef<Chart | null>(null)
  const studentChartRef = useRef<Chart | null>(null)

  const t = translations[language as keyof typeof translations] || translations.id

  useEffect(() => {
    // Load dashboard data
    loadDashboard()

    // Cleanup charts on unmount
    return () => {
      if (violationChartRef.current) {
        violationChartRef.current.destroy()
      }
      if (studentChartRef.current) {
        studentChartRef.current.destroy()
      }
    }
  }, [])

  useEffect(() => {
    // Reinitialize charts when language changes or data is loaded
    if (!isLoading) {
      initCharts()
    }
  }, [language, violationData, classData, isLoading])

  const loadDashboard = async () => {
    setIsLoading(true)
    try {
      // Load OSIS data directly from Firebase
      const osisRef = ref(db, "user-name-admin")
      const osisSnapshot = await get(osisRef)
      const osisData = osisSnapshot.val() || {}
      const osisMembers = Object.values(osisData) as any[]
      const osisOnlineCount = osisMembers.filter((user: any) => user.isOnline).length

      // Load pelanggaran data
      const pelanggaranRef = ref(db, "pelanggaran")
      const pelanggaranSnapshot = await get(pelanggaranRef)
      const pelanggaranData = pelanggaranSnapshot.val() || {}

      // Count total violations
      let totalPelanggar = 0
      const violationsByMonth: Record<string, number> = {}

      // Initialize months (ensure all months are represented)
      const months = t["months"].split(",")
      months.forEach((month, index) => {
        violationsByMonth[month.trim()] = 0
      })

      // Process violation data
      Object.keys(pelanggaranData).forEach((date) => {
        const dateObj = new Date(date)
        const monthIndex = dateObj.getMonth()
        const monthName = months[monthIndex]

        const dateViolations = Object.keys(pelanggaranData[date] || {}).length
        totalPelanggar += dateViolations

        // Increment the count for this month
        violationsByMonth[monthName] = (violationsByMonth[monthName] || 0) + dateViolations
      })

      // Prepare data for chart
      const violationLabels = Object.keys(violationsByMonth)
      const violationCounts = Object.values(violationsByMonth)

      setViolationData({
        labels: violationLabels,
        data: violationCounts,
      })

      // Load siswa data
      const siswaRef = ref(db, "siswa-i")
      const siswaSnapshot = await get(siswaRef)
      const siswaData = siswaSnapshot.val() || {}
      const siswaList = Object.values(siswaData) as any[]

      // Count students by class
      const classCounts: Record<string, number> = {}

      siswaList.forEach((siswa: any) => {
        const kelas = siswa.kelas || t["unknown-class"]
        classCounts[kelas] = (classCounts[kelas] || 0) + 1
      })

      // Prepare data for chart
      const classLabels = Object.keys(classCounts)
      const classCounts2 = Object.values(classCounts)

      setClassData({
        labels: classLabels,
        data: classCounts2,
      })

      setStats({
        osisOnline: osisOnlineCount,
        totalPelanggar,
        totalSiswa: siswaList.length,
      })
    } catch (error) {
      console.error("Error loading dashboard:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const initCharts = () => {
    // Violation chart
    const violationCtx = document.getElementById("violationChart") as HTMLCanvasElement
    if (violationCtx) {
      // Destroy previous chart instance if it exists
      if (violationChartRef.current) {
        violationChartRef.current.destroy()
      }

      violationChartRef.current = new Chart(violationCtx, {
        type: "bar",
        data: {
          labels: violationData.labels,
          datasets: [
            {
              label: t["jumlah-pelanggaran"] || "Jumlah Pelanggaran",
              data: violationData.data,
              backgroundColor: "rgba(37, 99, 235, 0.6)",
              borderColor: "rgba(37, 99, 235, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          scales: { y: { beginAtZero: true } },
          responsive: true,
        },
      })
    }

    // Student chart
    const studentCtx = document.getElementById("studentChart") as HTMLCanvasElement
    if (studentCtx) {
      // Destroy previous chart instance if it exists
      if (studentChartRef.current) {
        studentChartRef.current.destroy()
      }

      // Generate colors for each class
      const backgroundColors = classData.labels.map((_, index) => {
        const colors = [
          "rgba(249, 115, 22, 0.6)",
          "rgba(37, 99, 235, 0.6)",
          "rgba(107, 114, 128, 0.6)",
          "rgba(16, 185, 129, 0.6)",
          "rgba(236, 72, 153, 0.6)",
        ]
        return colors[index % colors.length]
      })

      const borderColors = classData.labels.map((_, index) => {
        const colors = [
          "rgba(249, 115, 22, 1)",
          "rgba(37, 99, 235, 1)",
          "rgba(107, 114, 128, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(236, 72, 153, 1)",
        ]
        return colors[index % colors.length]
      })

      studentChartRef.current = new Chart(studentCtx, {
        type: "pie",
        data: {
          labels: classData.labels,
          datasets: [
            {
              label: t["jumlah-siswa"] || "Jumlah Siswa",
              data: classData.data,
              backgroundColor: backgroundColors,
              borderColor: borderColors,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
        },
      })
    }
  }

  return (
    <div id="home" className="section">
      <h2 className="text-2xl font-semibold text-blue-600 mb-6 text-center flex items-center justify-center">
        <i className="material-icons mr-2 text-orange-400">dashboard</i>
        {t["dashboard"]}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center mb-2">{t["osis-online"]}</h3>
              <p className="animate-pulse">{stats.osisOnline}</p>
            </div>
            <i className="material-icons">group_work</i>
          </div>
        </div>

        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center mb-2">{t["total-pelanggar"]}</h3>
              <p className="animate-pulse">{stats.totalPelanggar}</p>
            </div>
            <i className="material-icons">report</i>
          </div>
        </div>

        <div className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center mb-2">{t["jumlah-siswa"]}</h3>
              <p className="animate-pulse">{stats.totalSiswa}</p>
            </div>
            <i className="material-icons">people_alt</i>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <i className="material-icons mr-2 text-orange-400">bar_chart</i>
            {t["statistik-pelanggaran"]}
          </h3>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <canvas id="violationChart"></canvas>
          )}
        </div>

        <div className="bg-card p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <i className="material-icons mr-2 text-orange-400">pie_chart</i>
            {t["jumlah-siswa-per-kelas"]}
          </h3>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <canvas id="studentChart"></canvas>
          )}
        </div>
      </div>
    </div>
  )
}
