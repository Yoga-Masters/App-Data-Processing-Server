// cls && npm test || cls && npm start
// ============================ PACKAGES SETUP =================================
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
// ============================ FIREBASE SETUP =================================
admin.initializeApp({ // Connecting to Firebase App Database
    credential: admin.credential.cert(require("./json/yoga-master-app-774bc242a8b4.json")),
    databaseURL: "https://yoga-master-app.firebaseio.com"
});
var appAdmin = admin.initializeApp({ // Connecting to Firebase Training Database
    credential: admin.credential.cert(require("./json/yoga-master-training-db-d9acdc86dca0.json")),
    databaseURL: "https://yoga-master-training-db.firebaseio.com"
}, "app");
console.log("Connected to yogamaster app firebase as \"" + admin.app().name + "\"");
console.log("Connected to training data firebase as \"" + appAdmin.name + "\"");
var adb = admin.database();
var tdb = appAdmin.database();
ensureDirectoryExistence("./processing/file.png");
ensureDirectoryExistence("./processing/processed/file.png");
// ========================= PASSIVE FIREBASE FUNCTIONS ========================
adb.ref("users").on("child_added", (snap) => {
    console.log("Starting download for " + snap.val().key + "...");
    adb.ref("users/" + snap.val().key + "/latestFrame").on("value", snap => {
        var data = snap.val();
        if (!data || data == "") return;
        var time = Date.now();
        var key = snap.ref.parent.key;
        var ext = data.split(';')[0].match(/jpeg|png|gif|jpg|webp/)[0];
        fs.writeFile("./processing/" + key + "." + ext, data.replace(/^data:image\/\w+;base64,/, ""), 'base64', err => {
            console.log("Saved new "+ext+" frame - latestFrame in " + (Date.now() - time) + "ms to ./processing/" + key + "." + ext + "...");
        });
    });
});
// ============================= HELPER FUNCTIONS ==============================
function ensureDirectoryExistence(filePath) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) return true;
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}