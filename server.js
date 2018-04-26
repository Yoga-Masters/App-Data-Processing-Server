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
var oprunning = false;
jimp.read("background.jpg", (err, image) => {
    background = image;
    console.log("Background ready!");
});
ensureDirectoryExistence("./processing/file.png");
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
adb.ref("size").on("value", snap => {
    size = snap.val();
    console.log("Size got updated to: " + size + "px!");
});
adb.ref("types").on("value", snap => {
    types = snap.val();
    console.log("types got updated to: " + JSON.stringify(types));
});
adb.ref("users").on("child_added", (snap) => {
    users[snap.val().key] = {
        "updating": snap.val().updating,
        "dimensions": snap.val().dimensions
    };
    adb.ref("users/" + snap.val().key + "/updating").on("value", snap => {
        users[snap.ref.parent.key].updating = snap.val();
    });
    adb.ref("users/" + snap.val().key + "/dimensions").on("value", snap => {
        users[snap.ref.parent.key].dimensions = snap.val();
    });
    adb.ref("users/" + snap.val().key + "/latestFrame").on("value", snap => {
        delete users[snap.ref.parent.key].file;
        var data = snap.val();
        if (!data || data == "") return;
        var time = Date.now();
        var key = snap.ref.parent.key;
        var ext = snap.val().split(';')[0].match(/jpeg|png|gif|jpg|webp/)[0];
        fs.writeFile("./processing/" + key + "." + ext, data.replace(/^data:image\/\w+;base64,/, ""), 'base64', err => {
            console.log("Saved new latestFrame from user " + key + " frame in " + (Date.now() - time) + "ms to ./processing/" + key + "." + ext + "...");
            users[snap.ref.parent.key].file = key + "." + ext;
            if (!oprunning) {
                runOpenPose("./processing", "./processing/processed", loopRunOpenPoseUpload);
                oprunning = true;
            }
        });
    });
});
// ==================== APP HANDLING PROCESSING FUNCTIONS ====================
function loopRunOpenPoseUpload(time) {
    handleAppDataUpdating(time);
    runOpenPose("./processing", "./processing/processed", loopRunOpenPoseUpload);
}

function handleAppDataUpdating(time) {
    var completion = {};
    console.log(users);
    console.log(Object.values(users));
    console.log(Object.values(users).map(x => x.file));
    var files = Object.values(users).map(x => x.file).filter(x => !x);
    console.log(files);
    if (!files) return;
    // fs.readdir("./processing", (err, files) => {
    files.forEach(file => {
        completion[file.slice(0, -(path.extname(file).length))] = false;
    });
    // });
    // fs.readdir("./processing", (err, files) => {
    files.forEach(file => {
        var ext = path.extname(file);
        var key = file.slice(0, -(ext.length));
        console.log("Starting file read for user " + key + " after " + (Date.now() - time) + "ms...");
        if (!users[key].updating) return;
        else fs.readFile("./processing/processed/" + key + "_keypoints.json", 'utf8', (err, data) => {
            console.log("Read file for user " + key + " finished in " + (Date.now() - time) + "ms. Processing images...");
            if (!data) return;
            var openPoseData = extractData(JSON.parse(data));
            console.log(openPoseData[0]);
            if (openPoseData[0].every(x => x === -1)) openPoseData[0] = getCenter(users[key].dimensions);
            else console.log("Openpose successfully found a whole person for user " + key + "!");
            imageProcessingAndUploadingAppData(key, ext, openPoseData, {}, time, () => {
                completion[key] = true;
                checkReqComplete(completion, () => {
                    console.log("Finished updating all files in " + (Date.now() - time) + "ms");
                });
            });
        });
    });
    // });
}

function imageProcessingAndUploadingAppData(key, ext, openPoseData, newData, time, cb) {
    imageProcessing("./processing/" + key + ext, openPoseData[0][0], openPoseData[0][1], openPoseData[0][2], openPoseData[0][3], (err, trainingImage) => {
        openPoseFrameProcessing("./processing/processed/" + key + "_rendered.png", users[key].dimensions, (err, openposeImage) => {
            console.log("Finished processing user " + key + " images in " + (Date.now() - time) + "ms. Uploading data...");
            newData["lastUpdated"] = Date.now();
            newData["latestOpenPoseFrame"] = openposeImage;
            newData["latestTensorData/latestProcessedFrame"] = trainingImage;
            for (var type in openPoseData)
                if (type > 0) newData["latestTensorData/datatype" + type] = openPoseData[type];
            adb.ref("users/" + key).update(newData, err => {
                console.log("Finished uploading user " + key + " data after " + (Date.now() - time) + "ms.");
                cb();
            });
        });
    });
}

function checkReqComplete(check, cb) {
    for (const done of Object.keys(check))
        if (!check[done]) return;
    cb();
}
// ==================== OPENPOSE + DATA PROCESSING FUNCTIONS ===================
// OpenPoseDemo.exe --image_dir [DIRECTORY] --write_images [DIRECTORY] --write_keypoint_json [DIRECTORY] --no_display
function runOpenPose(dir, outDir, callback) {
    var time = Date.now();
    if (outDir == "") outDir = dir;
    console.log("Running openPoseDemo on \"" + dir + "\" outputting to \"" + outDir + "\"...");
    exec("openPoseDemo", ["--image_dir", dir,
        "--write_images", outDir,
        "--write_keypoint_json", outDir,
        "--no_display"
    ], (error, stdout, stderr) => {
        console.log("Finished running openPoseDemo in " + (Date.now() - time) + "ms @ " + dir + " to " + outDir + "; processing files now...");
        callback(time);
    });
}
// Main extract data method that takes in poseData and returns array of data
function extractData(poseData) {
    var output = [
        [-1, -1, -1, -1], //DEFAULT CROP DIMENSIONS
        0, // 0, 1, OR ARRAY OF RELATIVE MAGNITUDES; MAKE CO-ORDINATES RELATIVE TO 0 -> 1, AND THEN FIND MAGNITUDES OF EACH POINTS FROM A AVERAGE POINT OF ALL POINTS
        0, // 0, 1, OR ARRAY OF RELATIVE CO-ORDINATE POSITIONS [X1, Y1, X2, Y2, ..., XN, YN], XN AND YN ARE BETWEEN 0 - 1
        0, // 0, 1, OR ARRAY OF ANGLES BASED ON YOUR OLD METHOD THAT MIGHT BE DIRECTION AGNOSTIC
        0 // 0, 1, OR ARRAY OF ANGLES AND MAGNITUDES CONCATENATED
        //0, // ANY OTHER WAYS WE CAN THINK OF GATHERING MEANING FROM OPEN POSE, MAYBE ANGLES BASED ON THE NEW WEBSITE WE FOUND?
    ];
    if (poseData.people.length == 0) return output; // Return 0s for nobody in frame
    output[1] = output[2] = output[3] = output[4] = 1;
    var personIndex = -1;
    for (var p = poseData.people.length - 1; p > -1; p--) {
        personIndex = p;
        for (var i = 3; i < 42; i++) // Change personIndex back to -1 if person data is incomplete
            if (poseData.people[p].pose_keypoints[i] == 0) personIndex = -1;
    }
    if (personIndex == -1) return output; // Return 1s for incomplete person in frame
    var keypoints = poseData.people[personIndex].pose_keypoints;
    output[0] = getCropData(keypoints); //Get crop data
    output[1] = extractMagnitudes(keypoints, output[0][2] - output[0][0]); //Relative magnitudes
    output[2] = extractRelativeCoordinates(keypoints, output[0]); //Relative coordinates
    output[3] = extractAngleRelativeToLine(keypoints); //Angle relative to vertical line
    output[4] = output[3].concat(output[1]); //Concat of relative angles to vertical line and relative magnitudes
    return output;
}
// Finds cropping dimensions for pose image.
// Inputs keypoints array from a JSON output from openpose
// Return [Upper left X coord, Upper left Y coord, Lower right X coord, Lower right Y coord]
// If no pose is found, return [280, 0, 1000, 720], a default center square for 720p webcams
// Note:   Does not guarantee that the coords are within original image dimensions.
//         Pads so the crop dimensions are square.
//         THIS DOES NOT GUARANTEE THAT THE COORDINATES ARE VALID (i.e. negative coords are possible)
function getCropData(keypoints) {
    var xMax = -Infinity;
    var xMin = Infinity;
    var yMax = -Infinity;
    var yMin = Infinity;
    for (i = 0; i < keypoints.length; i += 3) {
        if (keypoints[i] != 0 && xMin > keypoints[i]) xMin = keypoints[i];
        if (keypoints[i] != 0 && xMax < keypoints[i]) xMax = keypoints[i];
    }
    for (i = 1; i < keypoints.length; i += 3) {
        if (keypoints[i] != 0 && yMax < keypoints[i]) yMax = keypoints[i];
        if (keypoints[i] != 0 && yMin > keypoints[i]) yMin = keypoints[i];
    }
    xMax += 50;
    xMin -= 50;
    yMax += 50;
    yMin -= 50;
    var width = xMax - xMin;
    var height = yMax - yMin;
    if (width < height) {
        xMin -= (height - width) / 2;
        xMax += (height - width) / 2;
    } else if (width > height) {
        yMin -= (width - height) / 2;
        yMax += (width - height) / 2;
    }
    return [xMin, yMin, xMax, yMax].map(x => Math.round(x));
}
// Input: Keypoint array from Openpose JSON; Assumes it's complete and exists
// Output: Array of scaled magnitudes trimmed to 5 decimal places; Scale is magnitude / pose width
function extractMagnitudes(keypoints, size) {
    var avgX = 0;
    var avgY = 0;
    for (var i = 1; i <= 13; i++) {
        avgX += keypoints[i * 3];
        avgY += keypoints[i * 3 + 1];
    }
    avgX = avgX / 13;
    avgY = avgY / 13;
    return [
        parseFloat((magnitude(keypoints[15], keypoints[16], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[6], keypoints[7], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[18], keypoints[19], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[9], keypoints[10], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[21], keypoints[22], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[12], keypoints[13], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[33], keypoints[34], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[24], keypoints[25], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[36], keypoints[37], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[27], keypoints[28], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[39], keypoints[40], avgX, avgY) / size).toFixed(4)),
        parseFloat((magnitude(keypoints[30], keypoints[31], avgX, avgY) / size).toFixed(4))
    ];
}
// Return relative coords of keypoints [X1, Y1, X2, Y2, ...]
function extractRelativeCoordinates(keypoints, size) {
    var dimension = size[2] - size[0];
    var output = [];
    for (var i = 0; i <= 39; i += 3) {
        output.push(parseFloat(((keypoints[i] - size[1]) / dimension).toFixed(4)));
        output.push(parseFloat(((keypoints[i + 1] - size[0]) / dimension).toFixed(4)));
    }
    return output;
}
// Return relative coords of keypoints [Angle1, Angle2, Angle3, ...]
function extractAngleRelativeToLine(keypoints) {
    return [
        AngleRelativeToLine(keypoints[3], keypoints[4], keypoints[15], keypoints[16]),
        AngleRelativeToLine(keypoints[3], keypoints[4], keypoints[6], keypoints[7]),
        AngleRelativeToLine(keypoints[15], keypoints[16], keypoints[18], keypoints[19]),
        AngleRelativeToLine(keypoints[6], keypoints[7], keypoints[9], keypoints[10]),
        AngleRelativeToLine(keypoints[18], keypoints[19], keypoints[21], keypoints[22]),
        AngleRelativeToLine(keypoints[9], keypoints[10], keypoints[12], keypoints[13]),
        AngleRelativeToLine(keypoints[3], keypoints[4], keypoints[33], keypoints[34]),
        AngleRelativeToLine(keypoints[3], keypoints[4], keypoints[24], keypoints[25]),
        AngleRelativeToLine(keypoints[33], keypoints[34], keypoints[36], keypoints[37]),
        AngleRelativeToLine(keypoints[24], keypoints[25], keypoints[27], keypoints[28]),
        AngleRelativeToLine(keypoints[36], keypoints[37], keypoints[39], keypoints[40]),
        AngleRelativeToLine(keypoints[27], keypoints[28], keypoints[30], keypoints[31]),
    ];
}
// ======================== IMAGE PROCESSING FUNCTIONS ========================
function imageProcessing(path, x1, y1, x2, y2, cb) {
    var bg = background.clone();
    jimp.read(path, (err, image) => {
        if (err) {
            cb(false)
            console.log(err);
        } else bg.resize((x2 - x1), (y2 - y1)) // Resizes the 1x1 Gray to the size we need it
            .composite(image, -x1, -y1) //Composite the image to have no Grey
            .resize(size, size) //resize to 100 x 100
            .quality(100) // set JPEG quality
            .greyscale() // greyscale
            .getBase64(jimp.MIME_JPEG, cb); // return image as base64 in passed in callback
    });
}

function openPoseFrameProcessing(path, dims, cb) { // ADD POSSIBLE DIMENSION CROPPING BASED ON USERS?
    jimp.read(path, (err, image) => {
        var imgasprtio = image.bitmap.width / image.bitmap.height;
        var dimasprtio = dims[0] / dims[1];
        if (err) cb(false);
        else image
            .crop(0, 0, (((dimasprtio <= imgasprtio) ? (dimasprtio / imgasprtio) : 1) * image.bitmap.width), (((imgasprtio <= dimasprtio) ? (imgasprtio / dimasprtio) : 1) * image.bitmap.height))
            .resize(jimp.AUTO, size)
            .quality(100)
            .getBase64(jimp.MIME_JPEG, cb);
    });
}
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

function getRandomKey(len) {
    return crypto.randomBytes(Math.floor(len / 2) || 8).toString('hex');
}

function getCenter(dims) {
    var x = dims[0];
    var y = dims[1];
    if (x / y < 1) {
        return [0, (y - x) / 2, x, ((y - x) / 2) + x];
    } else if (x / y >= 1) {
        return [(x - y) / 2, 0, (x - y) / 2 + y]
    }
}

function readPose(name) {
    if (name.toLowerCase().includes("warriorii")) return "warriorii";
    else if (name.toLowerCase().includes("tree")) return "tree";
    else if (name.toLowerCase().includes("triangle")) return "triangle";
    else return false;
}

function magnitude(x1, y1, x2, y2) {
    return Math.abs(Math.pow((Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2)), 0.5));
}

function AngleRelativeToLine(x1, y1, x2, y2) {
    var angle = Math.round(radiansToDegrees(Math.acos((y2 - y1) / Math.pow((Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)), 0.5))));
    return (x2 > x1) ? angle : -angle;
}

function radiansToDegrees(radians) {
    return (radians * 180 / Math.PI);
}

function degreesToRadians(degrees) {
    return (degrees * Math.PI / 180);
}