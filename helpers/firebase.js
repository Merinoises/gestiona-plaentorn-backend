const path = require('path'); 
const admin = require('firebase-admin');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const b64 = process.env.FIREBASE_ADMIN_SDK;
if (!b64) {
  throw new Error('Variable FIREBASE_ADMIN_SDK no definida');
}

const serviceAccount = JSON.parse(
  Buffer.from(b64, 'base64').toString('utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
