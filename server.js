// cls && npm test || cls && npm start
// ============================ PACKAGES SETUP =================================
const fs = require('fs');
const path = require('path');
const jimp = require('jimp');
const admin = require('firebase-admin');
const exec = require('child_process').execFile;
// ============================= GLOBALS SETUP =================================
var size = 100;
var users = {};
var types = {};
var background;
jimp.read("background.jpg", (err, image) => {
    background = image;
    console.log("Background ready!");
});
ensureDirectoryExistence("./processing/latest/file.png");
ensureDirectoryExistence("./processing/processed/file.png");
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
// ========================= PASSIVE FIREBASE FUNCTIONS ========================
adb.ref("types").on("value", snap => {
    types = snap.val();
    console.log("types got updated to: " + JSON.stringify(types));
});
adb.ref("size").on("value", snap => {
    size = snap.val();
    console.log("Size got updated to: " + size + "px!");
});
// FIX PROCESSING SERVER
// adb.ref("users").on("child_added", (snap, prevChildKey) => {
//     users[snap.val().key] = {"updating": snap.val().updating, "dimensions": snap.val().dimensions};
//     adb.ref("users/" + snap.val().key + "/updating").on("value", snap => {
//         users[snap.ref.parent.key].updating = snap.val();
//     });
//     adb.ref("users/" + snap.val().key + "/dimensions").on("value", snap => {
//         users[snap.ref.parent.key].dimensions = snap.val();
//     });
// });
// adb.ref("users").on("child_added", (snap, prevChildKey) => {
//     users[snap.val().key] = snap.val().updating;
//     adb.ref("users/" + snap.val().key + "/updating").on("value", snap => {
//         users[snap.ref.parent.key] = snap.val();
//     });
//     adb.ref("users/" + snap.val().key + "/latestFrame").on("value", snap => {
//         var time = Date.now();
//         var data = snap.val();
//         if (!data || data == "") return;
//         var key = snap.ref.parent.key;
//         var ext = snap.val().split(';')[0].match(/jpeg|png|gif|jpg|webp/)[0];
//         fs.writeFile("./processing/latest/" + key + "." + ext, data.replace(/^data:image\/\w+;base64,/, ""), 'base64', err => {
//             console.log("Saved new latestFrame from user " + key + " frame in " + (Date.now() - time) + "ms to ./processing/latest/" + key + "." + ext + "...");
//             runOpenPose("./processing/latest", "./processing/processed", () => { //TODO: ALEX, CAN U REPLACE WITH 1 IMAGE ONLY OR FASTER OPENPOSE???
//                 handleAppDataUpdating(key, ext, time);
//             });
//         });
//     });
// adb.ref("users/" + snap.val().key + "/latestFrame").on("value", snap => {
//     var time = Date.now();
//     var data = snap.val();
//     if (!data || data == "") return;
//     var key = snap.ref.parent.key;
//     var ext = snap.val().split(';')[0].match(/jpeg|png|gif|jpg|webp/)[0];
//     fs.writeFile("./processing/pictures/" + key + "." + ext, data.replace(/^data:image\/\w+;base64,/, ""), 'base64', err => {
//         console.log("Saved new latestFrame from user " + key + " frame in " + (Date.now() - time) + "ms to ./processing/pictures/" + key + "." + ext + "...");
//         runOpenPose("./processing/pictures", "./processing/pictures/processed", () => { //TODO: ALEX, CAN U REPLACE WITH 1 IMAGE ONLY OR FASTER OPENPOSE???
//             handleAppDataUpdating(key, ext, time);
//         });
//     });
// });
// });
// ==================== APP HANDLING PROCESSING FUNCTIONS ====================
function handleAppDataUpdating(user, ext, time) {
    fs.readFile("./processing/pictures/processed/" + user + "_keypoints.json", 'utf8', (err, data) => {
        console.log("Finished reading file " + user + " json after " + (Date.now() - time) + "ms. Processing image...");
        if (!data) return;
        var openPoseData = extractData(JSON.parse(data));
        if (openPoseData[1] == 0 || openPoseData[1] == 1)
            updateAppData(user, openPoseData, {}, time);
        else imageProcessing("./processing/pictures/" + user + "." + ext, openPoseData[0][0], openPoseData[0][1], openPoseData[0][2], openPoseData[0][3], (err, trainingImage) => {
            console.log("Openpose successfully found a whole person!");
            updateAppData(user, openPoseData, {
                "latestTensorData/latestProcessedFrame": trainingImage
            }, time);
        });
    });
}

function updateAppData(user, openPoseData, newData, time) {
    openPoseFrameProcessing(("./processing/pictures/processed/" + user + "_rendered.png"), (err, openposeImage) => {
        console.log("Finished processing file " + user + " images after " + (Date.now() - time) + "ms. Uploading data...");
        newData["lastUpdated"] = Date.now();
        newData["latestOpenPoseFrame"] = openposeImage;
        for (var type in openPoseData)
            if (type > 0) newData["latestTensorData/datatype" + type] = openPoseData[type];
        adb.ref("users/" + user).update(newData);
    });
}
// ==================== OPENPOSE + IMG PROCESSING FUNCTIONS ====================
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
// TODO: ADD IN EXTRACT DATA STUFF
// ============================= HELPER FUNCTIONS ==============================
function ensureDirectoryExistence(filePath) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) return true;
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

function delFile(path, cb) {
    fs.unlink(path, cb);
}

function readPose(name) {
    if (name.toLowerCase().includes("warriorii")) return "warriorii";
    else if (name.toLowerCase().includes("tree")) return "tree";
    else if (name.toLowerCase().includes("triangle")) return "triangle";
    else return false;
}

function radiansToDegrees(radians) {
    return (radians * 180 / Math.PI);
}

function degreesToRadians(degrees) {
    return (degrees * Math.PI / 180);
}