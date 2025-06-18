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

        const { callerId, callerName, callType, callID } = callData;
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

              console.log(`Fetching caller name for callerId: ${callerId}`);
              const callerSnapshot = await db.ref(`user-name-admin/${callerId}`).once("value");
              const callerData = callerSnapshot.val();
              console.log(`Caller data for ${callerId}:`, callerData);

              const effectiveCallerName = callerData?.name && callerData.name.trim() !== ""
                ? callerData.name
                : (callerName && callerName.trim() !== "" ? callerName : "User");

              console.log(`Sending notification to playerId: ${playerId} with callerName: ${effectiveCallerName}`);

              const message = {
                app_id: oneSignalAppId,
                include_player_ids: [playerId],
                contents: { en: `Panggilan ${callType} Dari ${effectiveCallerName}` },
                headings: { en: "Panggilan Masuk" },
                data: {
                  callType: callType || "voice",
                  callId: callID,
                  callerName: effectiveCallerName,
                  recipientId: recipientId,
                },
                ios_sound: "call.wav",
                android_sound: "call",
                priority: 10,
                android_vibrate: true,
                vibration_pattern: [0, 1000, 500, 1000],
                ios_badgeType: "Increase",
                ios_badgeCount: 1,
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
    console.error("Failed to process call notifications:", error);
    return { success: false, error: "Gagal memproses notifikasi panggilan" };
  }
}

async function sendGeneralNotification() {
  try {
    const promises = [];

    // Process general notifications from /notifications
    const notificationsRef = db.ref("/notifications");
    const notificationSnapshot = await notificationsRef.once("value");

    if (notificationSnapshot.exists()) {
      notificationSnapshot.forEach((notificationSnapshot) => {
        const notificationData = notificationSnapshot.val();
        const notificationKey = notificationSnapshot.key;

        if (notificationData.sent) return;

        const name = notificationData.name || "Unknown";
        const date = notificationData.date || "No date";
        const imageUrl = notificationData.imageUrl || "";
        const content = notificationData.content || "";
        const title = `Berita Baru dari ${name}`;
        // Truncate content to 100 chars for notification body
        const truncatedContent = content.length > 100 ? `${content.substring(0, 97)}...` : content;
        // Construct body with content and date
        const body = `${truncatedContent}\n${date}`;

        console.log("Data baru di /notifications:", notificationData);

        promises.push(
          (async () => {
            try {
              const message = {
                app_id: oneSignalAppId,
                included_segments: ["All"],
                contents: { en: body },
                headings: { en: title },
                data: {
                  notificationId: notificationKey,
                  name: name,
                  date: date,
                  imageUrl: imageUrl,
                  content: content,
                },
                ios_sound: "default",
                android_sound: "default",
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

              console.log("Notifikasi umum dikirim:", response.data);
              await notificationsRef.child(notificationKey).update({ sent: true });
            } catch (error) {
              console.error("Gagal mengirim notifikasi umum:", error);
            }
          })()
        );
      });
    } else {
      console.log("No general notifications to process");
    }

    // Process violation notifications from /pelanggaran
    const violationsRef = db.ref("/pelanggaran");
    const violationSnapshot = await violationsRef.once("value");

    if (violationSnapshot.exists()) {
      violationSnapshot.forEach((dateSnapshot) => {
        const date = dateSnapshot.key; // e.g., "2025-06-13"
        dateSnapshot.forEach((violationSnapshot) => {
          const violationData = violationSnapshot.val();
          const violationKey = violationSnapshot.key; // e.g., "Dims", "bhhh", "dim"

          // Skip if already sent
          if (violationData.sent) return;

          const nama = violationData.nama || "Unknown";
          const jenisPelanggaran = violationData.jenisPelanggaran || "Tidak diketahui";
          const tanggalPelanggaran = violationData.tanggalPelanggaran || date || "No date";
          const fotoUrl = violationData.fotoUrl || "";
          const kelas = violationData.kelas || "Tidak diketahui";
          const nis = violationData.nis || "Tidak diketahui";
          const title = `Pelanggaran ${jenisPelanggaran} oleh ${nama}`;
          const content = `Nama: ${nama}dan Kelas: ${kelas} \n ${tanggalPelanggaran}`;
          const truncatedContent = content.length > 100 ? `${content.substring(0, 97)}...` : content;
          const body = `${truncatedContent}`;

          console.log(`Data baru di /pelanggaran/${date}/${violationKey}:`, violationData);

          promises.push(
            (async () => {
              try {
                const message = {
                  app_id: oneSignalAppId,
                  included_segments: ["All"],
                  contents: { en: body },
                  headings: { en: title },
                  data: {
                    violationId: `${date}/${violationKey}`,
                    nama: nama,
                    jenisPelanggaran: jenisPelanggaran,
                    tanggalPelanggaran: tanggalPelanggaran,
                    fotoUrl: fotoUrl,
                    kelas: kelas,
                    nis: nis,
                    content: content,
                  },
                  ios_sound: "default",
                  android_sound: "default",
                };

                if (fotoUrl) {
                  message.big_picture = fotoUrl;
                  message.ios_attachments = { image: fotoUrl };
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

                console.log(`Notifikasi pelanggaran dikirim untuk ${nama}:`, response.data);
                await violationsRef.child(date).child(violationKey).update({ sent: true });
              } catch (error) {
                console.error(`Gagal mengirim notifikasi pelanggaran untuk ${nama}:`, error);
              }
            })()
          );
        });
      });
    } else {
      console.log("No violations to process");
    }

    await Promise.all(promises);

    if (promises.length === 0) {
      return { success: true, message: "No notifications or violations to process" };
    }

    return { success: true, message: "Processed notifications and violations" };
  } catch (error) {
    console.error("Failed to process general notifications or violations:", error);
    return { success: false, error: "Gagal memproses notifikasi umum atau pelanggaran" };
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

    const { type } = await request.json(); // Ambil type dari body (call atau general)

    let result;
    if (type === "call") {
      result = await sendCallNotification();
    } else if (type === "general") {
      result = await sendGeneralNotification();
    } else {
      // Jalankan keduanya kalau type ga dispecify
      const callResult = await sendCallNotification();
      const generalResult = await sendGeneralNotification();
      result = {
        success: callResult.success && generalResult.success,
        message: {
          call: callResult.message,
          general: generalResult.message,
        },
        error: callResult.error || generalResult.error,
      };
    }

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("Error processing notifications:", error);
    return NextResponse.json({ error: "Gagal memproses notifikasi" }, { status: 500 });
  }
}