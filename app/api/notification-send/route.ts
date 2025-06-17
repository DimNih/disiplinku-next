import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const oneSignalAppId = process.env.ONESIGNAL_APP_ID || "2e698604-60d3-4108-8c34-972420e9703a";
const oneSignalApiKey = process.env.ONESIGNAL_API_KEY || "os_v2_app_fzuymbda2naqrdbus4scb2lqhjqztvsmegkue45oyjtkcz3txgq466qrqqczxljudorp7ec2u3d2wmxonhyqjdw3klitkacpnck3gra";

async function sendGeneralNotification() {
  try {
    const notificationsRef = db.ref("/notifications");
    const snapshot = await notificationsRef.once("value");

    if (!snapshot.exists()) {
      console.log("No notifications to process");
      return { success: true, message: "No notifications to process" };
    }

    const promises = [];
    snapshot.forEach((notificationSnapshot) => {
      const notificationData = notificationSnapshot.val();
      const notificationKey = notificationSnapshot.key;

      if (notificationData.sent) return;

      const name = notificationData.name || "Unknown";
      const date = notificationData.date || "No date";
      const imageUrl = notificationData.imageUrl || "";
      const content = notificationData.content || "";
      const titleEn = `New Post from ${name}`;
      const titleId = `Post Baru dari ${name}`;
      // Truncate content to 100 chars to fit OneSignal limits
      const truncatedContent = content.length > 100 ? `${content.substring(0, 97)}...` : content;
      const bodyEn = content ? `${truncatedContent} (${date})` : `${date}`;
      const bodyId = content ? `${truncatedContent} (${date})` : `${date}`;

      console.log("Data baru di /notifications:", notificationData);

      promises.push(
        (async () => {
          try {
            const message = {
              app_id: oneSignalAppId,
              included_segments: ["All"],
              contents: { en: bodyEn, id: bodyId },
              headings: { en: titleEn, id: titleId },
              data: {
                notificationId: notificationKey,
                name: name,
                date: date,
                imageUrl: imageUrl,
                content: content, // Full content in data
              },
              ios_sound: "notification.wav",
              android_sound: "notification",
              priority: 10,
              android_vibrate: true,
              vibration_pattern: [0, 500, 250, 500],
              ios_badgeType: "Increase",
              ios_badgeCount: 1,
              buttons: [
                {
                  id: "view-post",
                  text: { en: "View Post", id: "Lihat Postingan" },
                  icon: "ic_stat_onesignal_default",
                },
              ],
            };

            if (imageUrl) {
              message.big_picture = imageUrl;
              message.ios_attachments = { image: imageUrl };
            }

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

            console.log("Notifikasi dikirim:", response.data);
            await notificationsRef.child(notificationKey).update({ sent: true });
          } catch (error) {
            console.error("Gagal mengirim notifikasi:", error);
          }
        })()
      );
    });

    await Promise.all(promises);
    return { success: true, message: "Processed notifications" };
  } catch (error) {
    console.error("Failed to process general notifications:", error);
    return { success: false, error: "Gagal memproses notifikasi umum" };
  }
}

export async function POST(request: Request) {
  try {
    // Cek session (opsional, uncomment kalau perlu auth)
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    if (!process.env.SERVICE_ACCOUNT) {
      console.error("Missing Firebase service account");
      return NextResponse.json({ error: "Firebase configuration missing" }, { status: 500 });
    }

    const { type } = await request.json(); // Ambil type dari body (general)

    let result;
    if (type === "general" || !type) {
      result = await sendGeneralNotification();
    } else {
      return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
    }

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("Error processing notifications:", error);
    return NextResponse.json({ error: "Gagal memproses notifikasi" }, { status: 500 });
  }
}