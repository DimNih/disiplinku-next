"use client"

import { translations } from "@/lib/translations"
import { useToast } from "@/contexts/toast-context"
import { motion } from "framer-motion"
import { Menu, Bell, Moon, Sun, User, LogOut } from "lucide-react"
import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"

interface HeaderProps {
  toggleSidebar: () => void
  username: string
  language: string
}

export default function Header({ toggleSidebar, username, language }: HeaderProps) {
  const t = translations[language as keyof typeof translations] || translations.id
  const { showToast } = useToast()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [notifications, setNotifications] = useState<{ id: number; message: string; read: boolean }[]>([])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    // Simulate notifications
    setNotifications([
      { id: 1, message: t["welcome-dashboard"], read: false },
      { id: 2, message: t["new-violation"], read: false },
      { id: 3, message: t["system-updated"], read: true },
    ])
  }, [language, t])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    showToast(t["notifications"], t["all-notifications-read"], "success")
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const handleLogout = async () => {
    showToast(t["logging-out"], t["logout-confirm"], "info")
    setTimeout(() => signOut({ callbackUrl: "/login" }), 1500)
  }

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm py-4 px-6 flex flex-col sm:flex-row justify-between items-center mb-8 sticky top-0 z-10">
      <div className="flex items-center w-full sm:w-auto mb-4 sm:mb-0">
        <button
          className="mr-4 text-foreground hover:text-orange-400 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 rounded-md"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl md:text-3xl font-bold text-blue-600 tracking-tight"
        >
          {t["admin-dashboard"]}
        </motion.h1>
      </div>

      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <div className="relative">
          <button
            className="relative p-2 text-gray-600 hover:text-orange-500 dark:text-gray-300 dark:hover:text-orange-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label={t["notifications"]}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg overflow-hidden z-20 border dark:border-gray-700">
              <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-medium">{t["notifications"]}</h3>
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  {t["mark-all-read"]}
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${!notification.read ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                    >
                      <p className="text-sm">{notification.message}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date().toLocaleDateString()}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">{t["no-notifications"]}</div>
                )}
              </div>
              <div className="p-2 border-t dark:border-gray-700 text-center">
                <button
                  className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
                  onClick={() => setIsNotificationsOpen(false)}
                >
                  {t["close"]}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          className="p-2 text-gray-600 hover:text-orange-500 dark:text-gray-300 dark:hover:text-orange-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t["switch-light"] : t["switch-dark"]}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center text-white">
              <User className="h-5 w-5" />
            </div>
            <span className="font-medium text-foreground hidden md:block">{username}</span>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg overflow-hidden z-20 border dark:border-gray-700">
              <div className="p-3 border-b dark:border-gray-700">
                <p className="font-medium text-sm">{username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t["administrator"]}</p>
              </div>
              <div>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2 text-red-500" />
                  {t["logout"]}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
