import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config();

const rawServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
if (rawServiceAccount) {
    const sanitizedServiceAccount = rawServiceAccount.replace(/\\n/g, '\n').trim();
    const serviceAccountObj = JSON.parse(sanitizedServiceAccount);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountObj)
        });
    }
}

async function run() {
    try {
        const db = admin.firestore();
        const sessions = await db.collection("chat_sessions").limit(2).get();
        sessions.forEach(doc => {
            console.log("Doc ID:", doc.id);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    } catch(e) {
        console.error("Error", e);
    }
}
run();
