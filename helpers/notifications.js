// src/notifications.js
const admin = require('./firebase'); 

async function sendPush(token, title, body) {
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      android: { priority: 'high' },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default' } },
      },
    });
  } catch (err) {
    console.error('Error enviando push:', err);
  }
}

module.exports = { sendPush };
