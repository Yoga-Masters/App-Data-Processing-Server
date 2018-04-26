// cls && npm test || cls && npm start
// ============================ PACKAGES SETUP =================================
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const exec = require('child_process').execFile;
// ============================= GLOBALS SETUP =================================
var users = {};
var running = false;
ensureDirectoryExistence("./processing/file.png");
ensureDirectoryExistence("./processing/processed/file.png");
// ============================ FIREBASE SETUP =================================
admin.initializeApp({ // Connecting to Firebase App Database
    credential: admin.credential.cert(require("./json/yoga-master-app-774bc242a8b4.json")),
    databaseURL: "https://yoga-master-app.firebaseio.com"
});
console.log("Connected to yogamaster app firebase as \"" + admin.app().name + "\"");
var adb = admin.database();
// ========================= PASSIVE FIREBASE FUNCTIONS ========================
adb.ref("users").on("child_added", (snap) => {
    users[snap.val().key] = {
        "updating": snap.val().updating
    };
    adb.ref("users/" + snap.val().key + "/updating").on("value", snap => {
        users[snap.ref.parent.key].updating = snap.val();
        if(!running) loopOpenPose();
    });
});
// ==================== OPENPOSE + DATA PROCESSING FUNCTIONS ===================
function loopOpenPose() {
    if (Object.values(users).every(x => x.updating == false)) running = false;
    else {
        running = true;
        runOpenPose("./processing", "./processing/processed", loopOpenPose);
    }
}

function runOpenPose(dir, outDir, callback) { // OpenPoseDemo.exe --image_dir [DIRECTORY] --write_images [DIRECTORY] --write_keypoint_json [DIRECTORY] --no_display
    var time = Date.now();
    if (outDir == "") outDir = dir;
    console.log("Running openPoseDemo on \"" + dir + "\" outputting to \"" + outDir + "\"...");
    exec("openPoseDemo", ["--image_dir", dir,
        "--write_images", outDir,
        "--write_keypoint_json", outDir,
        "--no_display"
    ], (error, stdout, stderr) => {
        console.log("Finished running openPoseDemo in " + (Date.now() - time) + "ms @ " + dir + " to " + outDir + "; processing files now...");
        callback();
    });
}
// ============================= HELPER FUNCTIONS ==============================
function ensureDirectoryExistence(filePath) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) return true;
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}