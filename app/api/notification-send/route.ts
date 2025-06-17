import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const oneSignalAppId = process.env.ONESIGNAL_APP_ID || "2e698604-60d3-4108-8c34-972420e9703a";
const oneSignalApiKey = process.env.ONESIGNAL_API_KEY || "os_v2_app_fzuymbda2naqrdbus4scb2lqhjqztvsmegkue45oyjtkcz3txgq466qrqqczxljudorp7ec2u3d2wmxonhyqjdw3klitkacpnck3gra";

async function sendCallNotification() {
  try {
    const incomingCallsRef = db.ref("incomingCalls");
    const snapshot = await incomingCallsRef.once("value");

    if (!snapshot.exists()) {
      console.log("No incoming calls to process");
      return { success: true, message: "No incoming calls to process" };
    }

    const promises = [];
    snapshot.forEach((recipientSnapshot) => {
      const recipientId = recipientSnapshot.key;
      recipientSnapshot.forEach((callSnapshot) => {
        const callData = callSnapshot.val();
        const callKey = callSnapshot.key;

        if (!callData || callData.processed) return;

        const { callerId, callerName, callType, callId } = callData;
        promises.push(
          (async () => {
            try {
              console.log(`Fetching user data for recipient: ${recipientId}`);
              const recipientSnapshot = await db.ref(`user-name-admin/${recipientId}`).once("value");
              const recipientData = recipientSnapshot.val();
              console.log(`Recipient data for ${recipientId}:`, recipientData);

              if (!recipientData?.oneSignalPlayerId) {
                console.log(`No OneSignal player ID found for user ${recipientId}`);
                return;
              }

              const playerId = recipientData.oneSignalPlayerId;

              console.log(`Fetching caller name for ${callerId}`);
              const callerSnapshot = await db.ref(`user-name-admin/${callerId}`).once("value");
              const callerData = callerSnapshot.val();
              console.log(`Caller data ${callerId}:`, callerData);

              const effectiveCallerName = callerData?.name?.trim() || 
                (callerName?.trim() || "User");

              console.log(`Sending notification to ${playerId} with callerName: ${effectiveCallerName}`);

              const message = {
                app_id: oneSignalAppId,
                include_player_ids: [playerId],
                contents: { en: `Panggilan ${callType} dari ${effectiveCallerName}` },
                headings: { en: "Panggilan Masuk" },
                data: {
                  callType: callType || "general",
                  callId: callId,
                  callerName: effectiveCallerName,
                  recipientId: recipientId,
                },
                ios_sound: "call.wav",
                android_sound: "call",
                priority: 10,
                android_vibrate: true,
                vibration_pattern: [0, 1000, 500, 1000],
                ios_badge: "Increment",
                ios_badge_count: 1,
              };

              const response = await axios.post(
                "https://onesignal.com/api/v1/notifications",
                message,
                {
                  headers: {
                    Authorization: `Basic ${oneSignalApiKey}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              console.log(`Notification sent to ${recipientId}:`, response.data);
              await incomingCallsRef.child(recipientId).child(callKey).update({ processed: true });
            } catch (error) {
              console.error(`Error processing call for ${recipientId}:`, error);
            }
          })()
        );
      });
    });

    await Promise.all(promises);
    return { success: true, message: "Processed incoming calls" };
  } catch (error) {
    console.error("Gagal memproses notifikasi panggilan:", error);
    return { success: false, message: "Gagal memproses notifikasi panggilan" };
  }
}

async function sendGeneralNotification() {
  try {
    const notificationsRef = db.ref("/notifications");
    const snapshot = await notificationsRef.once("value");

    if (!snapshot.exists()) {
      console.log("Tidak ada notifikasi untuk diproses");
      return { success: true, message: "Tidak ada notifikasi untuk diproses" };
    }

    const promises = [];
    snapshot.forEach((notificationSnapshot) => {
      const notificationData = notificationSnapshot.val();
      const notificationKey = notificationSnapshot.key;

      if (notificationData.sent) return;

      const name = notificationData.name || "Unknown";
      const date = notificationData.date || "Tanpa tanggal";
      const imageUrl = notificationData.imageUrl || "";
      const content = notificationData.content || "";
      const titleEn = `New Post from ${name}!`;
      const titleId = `Post Baru dari ${name}!`;
      // Truncate content to 100 chars to fit OneSignal limits
      const truncatedContent = content.trim().length > 100 ? `${content.substring(0, 97)}...` : content;
      const bodyEn = content ? `${truncatedContent} (${date})` : `${date}`;
      const bodyId = content ? `${truncatedContent} (${date})` : `${date}`;

      console.log(`Mengirim notifikasi:`, { notificationData});

      promises.push(
        async () => {
          try {
            const message = {
              app_id: oneSignalAppId,
              included_segments: ["All"],
              contents: { en: bodyEn, id: bodyId },
              headings: { en: titleEn, id: titleId },
              data: {
                notificationId: notificationKey,
                postId: notificationData.id,
                name: name,
                date: date,
                imageUrl: imageUrl,
                content: content,
              },
              ios_sound: "notification.wav",
              android_sound: "notification",
              priority: 10,
              android_vibrate: true,
              vibration_pattern: [0, 500, 100, 500],
              ios_badge: "Increment",
              ios_badge_count: 1,
              buttons: [
                {
                  id: "view-post",
                  text: { en: "View Post", id: "Lihat Post" },
                  icon: "ic_stat_notification",
                },
                {
                  id: "share-post",
                  text: { en: "Share", id: "Bagikan" },
                  icon: "ic_stat_share",
                },
              ],
              small_icon: "ic_stat_notification",
              large_icon: imageUrl || "ic_large_icon",
            };

            if (imageUrl) {
              message.big_picture = imageUrl;
              message.attachments = { ios_image: imageUrl };
            }

            const response = await axios.post(
              "https://onesignal.com/api/notifications",
              message,
              {
                headers: {
                  Authorization: `Basic ${oneSignalAppId}`,
                  "Content-Type": "application/json",
                },
              }
            );

            console.log(`Notifikasi dikirim untuk ${notificationKey}:`, response.data);
            await notificationsRef.child(notificationKey).update({ sent: true });
          } catch (error) {
            console.error(`Gagal mengirim notifikasi untuk ${notificationKey}:`, error);
          }
        }
      );
    });

    await Promise.all(promises);
    return { success: true, message: "Notifikasi berhasil diproses" };
  } catch (error) {
    console.error("Gagal memproses notifikasi umum:", error);
    return { success: false, message: "Gagal memproses notifikasi umum" };
  }
}

export default async function handler(req: NextRequest, res: NextResponse) {
  try {
    if (!process.env.SERVICE_ACCOUNT) {
      console.error("Konfigurasi Firebase tidak ditemukan");
      return res.status(500).json({ message: "Konfigurasi Firebase tidak ditemukan" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Metode tidak diizinkan" });
    }

    const { type } = await req.json();

    let result;
    if (type === "call") {
      result = await sendCallNotification();
    } else if (type === "general") {
      result = await sendGeneralNotification();
    } else {
      const callResult = await sendCallNotification();
      const generalResult = await sendGeneralNotification();
      result = {
        success: callResult.success && generalResult.success,
        message: {
          call: callResult.message,
          general: generalResult.message,
        },
        error: callResult.message || generalResult.message,
      };
    }

    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error("Gagal memproses notifikasi:", error);
    return res.status(500).json({ message: "Gagal memproses notifikasi" });
  }
}