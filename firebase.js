const firebase = require("firebase-admin");

const serviceAccount = require("./firebase-key.json");

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
});

module.exports = firebase;
