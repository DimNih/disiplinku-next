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

    const promises: any[] = [];
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
              console.log(`Fetching user data untuk ${recipientId}`);
              const recipientSnapshot = await db.ref(`user-name-admin/${recipientId}`).once("value");
              const recipientData = recipientSnapshot.val();
              console.log(`Recipient data untuk ${recipientId}:`, recipientData);

              if (!recipientData?.oneSignalPlayerId) {
                console.log(`No OneSignal player ID found for user ${recipientId}`);
                return;
              }

              const playerId = recipientData.oneSignalPlayerId;

              console.log(`Fetching caller name for ${callerId}`);
              const callerSnapshot = await db.ref(`user-name-admin/${callerId}`).once("value");
              const callerData = callerSnapshot.val();
              console.log(`Caller data for ${callerId}:`, callerData);

              const effectiveCallerName = callerData?.name && callerData.name.trim() !== ""
                ? callerData.name
                : (callerName && callerName.trim() !== "" ? callerName : "User");

              console.log(`Sending notification untuk ${playerId} dengan ${effectiveCallerName}`);

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

              console.log(`Notification sent ke ${recipientId}:`, response.data);
              await incomingCallsRef.child(recipientId).child(callKey).update({ processed: true });
            } catch (error) {
              console.error(`Error memproses panggilan untuk ${recipientId}:`, error);
            }
          })()
        );
      });
    });

    await Promise.all(promises);
    return { success: true, message: "Memproses panggilan masuk" };
  } catch (error) {
    console.error("Gagal memproses panggilan notifikasi:", error);
    return { success: false, error: "Gagal memproses notifikasi panggilan" };
  }
}

async function sendGeneralNotification() {
  try {
    const promises: any[] = [];

    // Process general notifications dari /notifications
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
        const photoUrl = notificationData.photoUrl || "";
        const content = notificationData.content || "";
        const title = `${name}`; // Meniru gaya media sosial: hanya nama
        // Memotong konten hingga 100 karakter untuk badan notifikasi
        const truncatedContent = content.length > 100 ? `${content.substring(0, 97)}...` : content;
        // Membuat badan dengan konten dan tanggal
        const body = `${truncatedContent}\n${date}`;

        console.log("Data baru di /notifications:", notificationData);
        console.log("Photo URL untuk notifikasi umum:", photoUrl);
        console.log("Image URL untuk notifikasi umum:", imageUrl);

        promises.push(
          (async () => {
            try {
              const message: any = {
                app_id: oneSignalAppId,
                included_segments: ["All"],
                contents: { en: body },
                headings: { en: title },
                data: {
                  notificationId: notificationKey,
                  name: name,
                  date: date,
                  imageUrl: imageUrl,
                  photoUrl: photoUrl,
                  content: content,
                },
                ios_sound: "default",
                android_sound: "default",
                android_small_icon: "ic_stat_onesignal_default", // Fallback ke ikon default
                mutable_content: true, // Mengaktifkan styling notifikasi kustom iOS
              };

              // Validasi URL imageUrl
              if (imageUrl) {
                try {
                  const response = await axios.head(imageUrl);
                  if (response.status === 200) {
                    message.big_picture = imageUrl; // Gambar besar di bawah konten
                    message.ios_attachments = { image: imageUrl }; // Gambar besar untuk iOS
                  } else {
                    console.log(`Image URL tidak valid: ${imageUrl}`);
                  }
                } catch (error) {
                  console.error(`Error memvalidasi image URL ${imageUrl}:`, error);
                }
              }

              // Validasi URL photoUrl
              if (photoUrl) {
                try {
                  const response = await axios.head(photoUrl);
                  if (response.status === 200) {
                    if (!message.ios_attachments) message.ios_attachments = {};
                    message.ios_attachments.profile = photoUrl; // Foto profil untuk iOS
                  } else {
                    console.log(`Photo URL tidak valid: ${photoUrl}`);
                  }
                } catch (error) {
                  console.error(`Error memvalidasi photo URL ${photoUrl}:`, error);
                }
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
      console.log("Tidak ada notifikasi umum untuk diproses");
    }

    // Memproses notifikasi pelanggaran dari /pelanggaran
    const violationsRef = db.ref("/pelanggaran");
    const violationSnapshot = await violationsRef.once("value");

    if (violationSnapshot.exists()) {
      violationSnapshot.forEach((dateSnapshot) => {
        const date = dateSnapshot.key; // misalnya, "2025-06-13"
        dateSnapshot.forEach((violationSnapshot) => {
          const violationData = violationSnapshot.val();
          const violationKey = violationSnapshot.key; // misalnya, "Dims", "bhhh", "dim"

          // Lewati jika sudah dikirim
          if (violationData.sent) return;

          const nama = violationData.nama || "Unknown";
          const jenisPelanggaran = violationData.jenisPelanggaran || "Tidak diketahui";
          const tanggalPelanggaran = violationData.tanggalPelanggaran || date || "No date";
          const fotoUrl = violationData.fotoUrl || ""; // Menggunakan fotoUrl sesuai data Firebase
          const kelas = violationData.kelas || "Tidak diketahui";
          const nis = violationData.nis || "Tidak diketahui";
          const title = `${nama}`; // Meniru gaya media sosial: hanya nama
          // Membuat konten dengan detail pelanggaran
          const content = `Pelanggaran: ${jenisPelanggaran}\nNama: ${nama}\nKelas: ${kelas}\nNIS: ${nis}`;
          // Memotong konten hingga 100 karakter untuk badan notifikasi
          const truncatedContent = content.length > 100 ? `${content.substring(0, 97)}...` : content;
          // Membuat badan dengan konten dan tanggal
          const body = `${truncatedContent}\n${tanggalPelanggaran}`;

          console.log(`Data baru di /pelanggaran/${date}/${violationKey}:`, violationData);
          console.log("Foto URL untuk notifikasi pelanggaran:", fotoUrl);

          promises.push(
            (async () => {
              try {
                const message: any = {
                  app_id: oneSignalAppId,
                  included_segments: ["All"],
                  contents: { en: body },
                  headings: { en: title },
                  data: {
                    violationId: `${date}/${violationKey}`,
                    nama: nama,
                    jenisPelanggaran: jenisPelanggaran,
                    Contribution: The code provided was incomplete, and the response was cut off before completion. Below, I will continue from where the previous response left off to provide a complete and corrected version of the `route.ts` file, addressing the issue of the profile photo (`photoUrl`) not appearing in general notifications and ensuring consistency with the Firebase data structure (using `fotoUrl` for violations). I will also incorporate URL validation, improve logging, and provide detailed testing steps with Postman to verify the endpoint `https://adminku-web.vercel.app/api/notification-send`. Additionally, I will explain why the profile photo might not appear and offer solutions tailored to the client app type (PWA or native).

### Completing the Code
The previous response was cut off in the `sendGeneralNotification` function, specifically in the violation notification section. Below is the complete and corrected `route.ts` file, continuing from the violation notification block. The changes include:
- Using `fotoUrl` consistently for violation notifications to match Firebase data (`violationData.fotoUrl`).
- Adding URL validation for both `imageUrl` and `photoUrl`/`fotoUrl` using `axios.head`.
- Ensuring type safety with `any` for the `message` object to avoid TypeScript errors.
- Maintaining the existing `sendCallNotification` function, as it is correct and unrelated to the profile photo issue.
- Adding detailed logging for debugging.

### Corrected Code
<xaiArtifact artifact_id="c0b1e03a-f034-4540-9b8c-ac7486cf033f" artifact_version_id="db44db75-bc24-4e6d-a935-39dbffc80bf0" title="route.ts" contentType="text/typescript">
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

    const promises: any[] = [];
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
              console.log(`Fetching user data untuk ${recipientId}`);
              const recipientSnapshot = await db.ref(`user-name-admin/${recipientId}`).once("value");
              const recipientData = recipientSnapshot.val();
              console.log(`Recipient data untuk ${recipientId}:`, recipientData);

              if (!recipientData?.oneSignalPlayerId) {
                console.log(`No OneSignal player ID found for user ${recipientId}`);
                return;
              }

              const playerId = recipientData.oneSignalPlayerId;

              console.log(`Fetching caller name for ${callerId}`);
              const callerSnapshot = await db.ref(`user-name-admin/${callerId}`).once("value");
              const callerData = callerSnapshot.val();
              console.log(`Caller data for ${callerId}:`, callerData);

              const effectiveCallerName = callerData?.name && callerData.name.trim() !== ""
                ? callerData.name
                : (callerName && callerName.trim() !== "" ? callerName : "User");

              console.log(`Sending notification untuk ${playerId} dengan ${effectiveCallerName}`);

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

              console.log(`Notification sent ke ${recipientId}:`, response.data);
              await incomingCallsRef.child(recipientId).child(callKey).update({ processed: true });
            } catch (error) {
              console.error(`Error memproses panggilan untuk ${recipientId}:`, error);
            }
          })()
        );
      });
    });

    await Promise.all(promises);
    return { success: true, message: "Memproses panggilan masuk" };
  } catch (error) {
    console.error("Gagal memproses panggilan notifikasi:", error);
    return { success: false, error: "Gagal memproses notifikasi panggilan" };
  }
}

async function sendGeneralNotification() {
  try {
    const promises: any[] = [];

    // Process general notifications dari /notifications
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
        const photoUrl = notificationData.photoUrl || "";
        const content = notificationData.content || "";
        const title = `${name}`; // Meniru gaya media sosial: hanya nama
        // Memotong konten hingga 100 karakter untuk badan notifikasi
        const truncatedContent = content.length > 100 ? `${content.substring(0, 97)}...` : content;
        // Membuat badan dengan konten dan tanggal
        const body = `${truncatedContent}\n${date}`;

        console.log("Data baru di /notifications:", notificationData);
        console.log("Photo URL untuk notifikasi umum:", photoUrl);
        console.log("Image URL untuk notifikasi umum:", imageUrl);

        promises.push(
          (async () => {
            try {
              const message: any = {
                app_id: oneSignalAppId,
                included_segments: ["All"],
                contents: { en: body },
                headings: { en: title },
                data: {
                  notificationId: notificationKey,
                  name: name,
                  date: date,
                  imageUrl: imageUrl,
                  photoUrl: photoUrl,
                  content: content,
                },
                ios_sound: "default",
                android_sound: "default",
                android_small_icon: "ic_stat_onesignal_default", // Fallback ke ikon default
                mutable_content: true, // Mengaktifkan styling notifikasi kustom iOS
              };

              // Validasi URL imageUrl
              if (imageUrl) {
                try {
                  const response = await axios.head(imageUrl);
                  if (response.status === 200) {
                    message.big_picture = imageUrl; // Gambar besar di bawah konten
                    message.ios_attachments = { image: imageUrl }; // Gambar besar untuk iOS
                  } else {
                    console.log(`Image URL tidak valid: ${imageUrl}`);
                  }
                } catch (error) {
                  console.error(`Error memvalidasi image URL ${imageUrl}:`, error);
                }
              }

              // Validasi URL photoUrl
              if (photoUrl) {
                try {
                  const response = await axios.head(photoUrl);
                  if (response.status === 200) {
                    if (!message.ios_attachments) message.ios_attachments = {};
                    message.ios_attachments.profile = photoUrl; // Foto profil untuk iOS
                  } else {
                    console.log(`Photo URL tidak valid: ${photoUrl}`);
                  }
                } catch (error) {
                  console.error(`Error memvalidasi photo URL ${photoUrl}:`, error);
                }
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
      console.log("Tidak ada notifikasi umum untuk diproses");
    }

    // Memproses notifikasi pelanggaran dari /pelanggaran
    const violationsRef = db.ref("/pelanggaran");
    const violationSnapshot = await violationsRef.once("value");

    if (violationSnapshot.exists()) {
      violationSnapshot.forEach((dateSnapshot) => {
        const date = dateSnapshot.key; // misalnya, "2025-06-13"
        dateSnapshot.forEach((violationSnapshot) => {
          const violationData = violationSnapshot.val();
          const violationKey = violationSnapshot.key; // misalnya, "Dims", "bhhh", "dim"

          // Lewati jika sudah dikirim
          if (violationData.sent) return;

          const nama = violationData.nama || "Unknown";
          const jenisPelanggaran = violationData.jenisPelanggaran || "Tidak diketahui";
          const tanggalPelanggaran = violationData.tanggalPelanggaran || date || "No date";
          const fotoUrl = violationData.fotoUrl || ""; // Menggunakan fotoUrl sesuai data Firebase
          const kelas = violationData.kelas || "Tidak diketahui";
          const nis = violationData.nis || "Tidak diketahui";
          const title = `${nama}`; // Meniru gaya media sosial: hanya nama
          // Membuat konten dengan detail pelanggaran
          const content = `Pelanggaran: ${jenisPelanggaran}\nNama: ${nama}\nKelas: ${kelas}\nNIS: ${nis}`;
          // Memotong konten hingga 100 karakter untuk badan notifikasi
          const truncatedContent = content.length > 100 ? `${content.substring(0, 97)}...` : content;
          // Membuat badan dengan konten dan tanggal
          const body = `${truncatedContent}\n${tanggalPelanggaran}`;

          console.log(`Data baru di /pelanggaran/${date}/${violationKey}:`, violationData);
          console.log("Foto URL untuk notifikasi pelanggaran:", fotoUrl);

          promises.push(
            (async () => {
              try {
                const message: any = {
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
                  android_small_icon: "ic_stat_onesignal_default", // Fallback ke ikon default
                  mutable_content: true, // Mengaktifkan styling notifikasi kustom iOS
                };

                // Validasi URL fotoUrl
                if (fotoUrl) {
                  try {
                    const response = await axios.head(fotoUrl);
                    if (response.status === 200) {
                      message.big_picture = fotoUrl; // Gambar besar di bawah konten
                      message.ios_attachments = { image: fotoUrl, profile: fotoUrl }; // Gambar besar dan profil untuk iOS
                    } else {
                      console.log(`Foto URL tidak valid: ${fotoUrl}`);
                    }
                  } catch (error) {
                    console.error(`Error memvalidasi foto URL ${fotoUrl}:`, error);
                  }
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
      console.log("Tidak ada pelanggaran untuk diproses");
    }

    await Promise.all(promises);

    if (promises.length === 0) {
      return { success: true, message: "Tidak ada notifikasi atau pelanggaran untuk diproses" };
    }

    return { success: true, message: "Memproses notifikasi dan pelanggaran" };
  } catch (error) {
    console.error("Gagal memproses notifikasi umum atau pelanggaran:", error);
    return { success: false, error: "Gagal memproses notifikasi umum atau pelanggaran" };
  }
}

export async function POST(request: Request) {
  try {
    // Cek sesi (opsional, uncomment kalau perlu auth)
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    if (!process.env.SERVICE_ACCOUNT) {
      console.error("Layanan akun Firebase tidak ada");
      return NextResponse.json({ error: "Konfigurasi Firebase tidak ada" }, { status: 500 });
    }

    const { type } = await request.json(); // Ambil tipe dari body (call atau general)

    let result;
    if (type === "call") {
      result = await sendCallNotification();
    } else if (type === "general") {
      result = await sendGeneralNotification();
    } else {
      // Jalankan keduanya kalau tipe tidak dispesifikasi
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
    console.error("Error memproses notifikasi:", error);
    return NextResponse.json({ error: "Gagal memproses notifikasi" }, { status: 500 });
  }
}