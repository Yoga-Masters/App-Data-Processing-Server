// cls && npm test || cls && npm start
// ============================ PACKAGES SETUP =================================
const fs = require('fs');
const path = require('path');
const jimp = require('jimp');
const tfdta = require('./data');
const tftls = require('./tftools');
const admin = require('firebase-admin');
const exec = require('child_process').execFile;
// ============================= GLOBALS SETUP =================================
let model;
var tcnfg;
var stype;
var poseIndex;
var background;
var size = 100;
var users = {};
var types = {};
var time = Date.now();
var oprunning = false;
jimp.read("background.jpg", (err, image) => {
    background = image;
    console.log("Background ready after " + (Date.now() - time) + "ms!");
});
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
tdb.ref("config").once("value", config => {
    config = config.val();
    size = config.size;
    console.log("Size got updated after " + (Date.now() - time) + "ms to: " + size + "px!");
    stype = config.data;
    console.log("Selected Data Type got updated after " + (Date.now() - time) + "ms to: " + stype + "!");
    types = config.types;
    console.log("Types got updated after " + (Date.now() - time) + "ms to: " + JSON.stringify(types));
    poseIndex = (Object.values(config.poseIndex)).sort().reduce((accumulator, currentValue, currentIndex, array) => {
        accumulator[Object.keys(config.poseIndex)[Object.values(config.poseIndex).indexOf(array[currentIndex])]] = array[currentIndex];
        return accumulator;
    }, {});
    console.log("PoseIndex got updated after " + (Date.now() - time) + "ms to: " + JSON.stringify(poseIndex));
    tcnfg = config.training[config.training.config + "Training"];
    console.log("Training Config got updated after " + (Date.now() - time) + "ms to: " + JSON.stringify(tcnfg));
    console.log("Got " + tfdta.getSelectedNumClasses() + " classes: " + tfdta.getSelectedClasses() + " to train for, along with " + getSelectedDataColNum() + " rows X " + tfdta.getSelectedNumData() - 1 + " columns of data to train with...");
    console.log("\nTraining with the " + tcnfg.speed + " config...");
    tftls.getTrainedModel([tfdta.getSelectedClasses(), tfdta.getSelectedData()], [tcnfg.testSplit, tcnfg.learningRate, tcnfg.epochs, tcnfg.minAccuracy, tcnfg.maxLoss]).then(mdl => { // Calling the train model function and logging the results
        model = mdl.model;
        console.log("\n\n\nTraining finished after " + (Date.now() - time) + "ms, with an accuracy of: " + Math.round(mdl.accuracy * 100) + (mdl.accuracy >= tcnfg.minAccuracy ? "% → GOOD" : "% → BAD") + ", along with a loss of: " + mdl.loss + (mdl.loss <= tcnfg.maxLoss ? " → GOOD" : " → BAD" + "."));
        tftls.getConfidences(model, [90, -90, 104, -91, 103, -98, 11, -16, 65, -41, 13, -47, 0.2361, 0.2278, 0.3813, 0.345, 0.5326, 0.5019, 0.1254, 0.1362, 0.351, 0.3801, 0.5667, 0.641, 0.9857, -0.2986, 0.9227, -0.1958, 0.8266, -0.1959, 0.6411, -0.1994, 0.469, -0.2225, 1.0154, -0.1958, 1.1944, -0.239, 1.3566, -0.2755, 0.83, 0.1255, 0.6711, 0.3109, 0.479, 0.4896, 0.9822, 0.1189, 1.1976, 0.2181, 1.254, 0.4667]).then(confs => {
            console.log("AFTER " + (Date.now() - time) + "MS, MAIN RUNNER WARRIOR II:", confs, tfdta.getSelectedClasses()[confs.indexOf(Math.max.apply({}, confs))]);
        });
        tftls.getConfidences(model, [90, -86, 12, -8, -126, 152, 10, -14, -6, -47, -12, 96, 0.2771, 0.2521, 0.1808, 0.1233, 0.1665, 0.1643, 0.0863, 0.0517, 0.2708, 0.3061, 0.4907, 0.1845, 0.8397, -0.2068, 0.8397, -0.0718, 0.7432, -0.0655, 0.7207, 0.0953, 0.7592, 0.0215, 0.936, -0.0718, 0.9714, 0.0888, 0.8878, 0.0277, 0.7721, 0.2078, 0.5858, 0.3813, 0.7849, 0.3589, 0.8911, 0.2142, 0.8651, 0.4425, 0.8172, 0.6674]).then(confs => {
            console.log("AFTER " + (Date.now() - time) + "MS, MAIN RUNNER TREE:", confs, tfdta.getSelectedClasses()[confs.indexOf(Math.max.apply({}, confs))]);
        });
        tftls.getConfidences(model, [171, -14, 150, -14, 158, -18, 84, 62, 38, -38, 28, -42, 0.2391, 0.1515, 0.3743, 0.2323, 0.5273, 0.3598, 0.1988, 0.0904, 0.3459, 0.1699, 0.581, 0.4169, 0.5965, 0.0513, 0.7238, 0.016, 0.7025, 0.1043, 0.66, 0.2773, 0.6142, 0.4151, 0.7377, -0.0689, 0.8296, -0.2312, 0.8896, -0.3832, 0.939, 0.1324, 0.8014, 0.3056, 0.6283, 0.4961, 1.0239, 0.0479, 1.1793, 0.2457, 1.31, 0.4963]).then(confs => {
            console.log("AFTER " + (Date.now() - time) + "MS, MAIN RUNNER TRIANGLE:", confs, tfdta.getSelectedClasses()[confs.indexOf(Math.max.apply({}, confs))]);
        });
        tftls.getConfidences(model, [92, -84, 21, -18, -81, 72, 15, -9, 6, -2, 8, 4, 0.2916, 0.2874, 0.2008, 0.2026, 0.1328, 0.1164, 0.0675, 0.0632, 0.2395, 0.2351, 0.4271, 0.4211, 0.9223, -0.3148, 0.9091, -0.1891, 0.8098, -0.1791, 0.7634, -0.0401, 0.8562, -0.0104, 1.0116, -0.1925, 1.0613, -0.06, 0.9555, -0.0435, 0.8627, 0.1055, 0.8563, 0.3107, 0.8694, 0.5029, 0.9887, 0.099, 1.0117, 0.3074, 1.0381, 0.4963]).then(confs => {
            console.log("AFTER " + (Date.now() - time) + "MS, MAIN RUNNER NONE:", confs, tfdta.getSelectedClasses()[confs.indexOf(Math.max.apply({}, confs))]);
        });
        console.log("App Server setup in " + (Date.now() - time) + "ms.");
        startAppServer();
    });
});

function startAppServer() {
    adb.ref("users").on("child_added", (snap) => {
        console.log("Starting process for " + snap.val().key + "...");
        users[snap.val().key] = {
            "updating": snap.val().updating,
            "dimensions": snap.val().dimensions,
            "working": false
        };
        adb.ref("users/" + snap.val().key + "/updating").on("value", snap => {
            users[snap.ref.parent.key].updating = snap.val();
        });
        adb.ref("users/" + snap.val().key + "/dimensions").on("value", snap => {
            users[snap.ref.parent.key].dimensions = snap.val();
        });
        adb.ref("users/" + snap.val().key + "/latestFrame").on("value", snap => {
            var key = snap.ref.parent.key;
            if (!users[key].working) {
                users[key].working = true;
                var data = snap.val();
                if (!data || data == "") return;
                var time = Date.now();
                var ext = data.split(';')[0].match(/jpeg|png|gif|jpg|webp/)[0];
                ensureDirectoryExistence("./processing/" + key + "/img." + ext);
                fs.writeFile("./processing/" + key + "/img." + ext, data.replace(/^data:image\/\w+;base64,/, ""), 'base64', err => {
                    console.log("Saved new " + ext + " frame - latestFame in " + (Date.now() - time) + "ms to ./processing/" + key + "/img." + ext + "...");
                    users[key].working = false;
                    runOpenPose("./processing/" + key, "./processing/" + key + "/processed", time, () => {
                        console.log("Starting file read for user " + key + " after " + (Date.now() - time) + "ms...");
                        fs.readFile("./processing/" + key + "/processed/img_keypoints.json", 'utf8', (err, data) => {
                            console.log("JSON file read for user " + key + " finished in " + (Date.now() - time) + "ms. Running Tensorflow...");
                            var openPoseData = extractData(JSON.parse(data));
                            if (openPoseData[0].every(x => x === -1)) openPoseData[0] = getCenter(users[key].dimensions);
                            else console.log("Openpose successfully found a whole person for user " + key + "!");
                            var newData = {};
                            console.log("Running Tensorflow prediction with Openpose Data with selected data " + types[stype] + "...")
                            tftls.getConfidences(model, openPoseData[stype]).then(confs => {
                                console.log("After " + (Date.now() - time) + "ms, got confidences:", confs, tfdta.getSelectedClasses()[confs.indexOf(Math.max.apply({}, confs))], ". Processing images...");
                                imageProcessing("./processing/" + key + "/img." + ext, openPoseData[0][0], openPoseData[0][1], openPoseData[0][2], openPoseData[0][3], (errA, trainingImage) => {
                                    openPoseFrameProcessing("./processing/" + key + "/processed/img_rendered.png", users[key].dimensions, (errB, openposeImage) => {
                                        console.log("Finished processing user " + key + " images in " + (Date.now() - time) + "ms. Uploading data...");
                                        newData["lastUpdated"] = Date.now();
                                        newData["latestOpenPoseFrame"] = openposeImage;
                                        newData["latestTensorData/latestProcessedFrame"] = trainingImage;
                                        for (var type in openPoseData)
                                            if (type > 0) newData["latestTensorData/datatype" + type] = openPoseData[type];
                                        for (var i = 0; i < tfdta.getSelectedClasses().length; i++)
                                            newData["latestConfidences/" + tfdta.getSelectedClasses()[i]] = confs[i];
                                        adb.ref("users/" + key).update(newData, err => {
                                            console.log("Finished uploading user " + key + " data after " + (Date.now() - time) + "ms.");
                                            users[key].working = false;
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }
        });
    });
}
// ==================== OPENPOSE + DATA PROCESSING FUNCTIONS ===================
function runOpenPose(dir, outDir, time, callback) { // OpenPoseDemo.exe --image_dir [DIRECTORY] --write_images [DIRECTORY] --write_keypoint_json [DIRECTORY] --no_display
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
            cb(err);
            console.log("\n" + err);
        } else bg.resize((x2 - x1), (y2 - y1)) // Resizes the 1x1 Gray to the size we need it
            .composite(image, -x1, -y1) //Composite the image to have no Grey
            .resize(size, size) //resize to 100 x 100
            .greyscale() // greyscale
            .quality(100) // set JPEG quality
            .getBase64(bg.getMIME(), cb); // return image as base64 in passed in callback
    });
}

function openPoseFrameProcessing(path, dims, cb) {
    jimp.read(path, (err, image) => {
        if (err) {
            cb(err);
            console.log("\n" + err);
        } else {
            var imgasprtio = image.bitmap.width / image.bitmap.height;
            var dimasprtio = dims[0] / dims[1];
            image.crop(0, 0, (((dimasprtio <= imgasprtio) ? (dimasprtio / imgasprtio) : 1) * image.bitmap.width), (((imgasprtio <= dimasprtio) ? (imgasprtio / dimasprtio) : 1) * image.bitmap.height))
                .resize(jimp.AUTO, size)
                .quality(100)
                .getBase64(image.getMIME(), cb);
        }
    });
}
// ============================= HELPER FUNCTIONS ==============================
function getSelectedDataColNum() {
    return tfdta.getSelectedData().length;
}

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
    var x = parseInt(dims[0]);
    var y = parseInt(dims[1]);
    if (x / y < 1) {
        return [0, (y - x) / 2, x, ((y - x) / 2) + x];
    } else if (x / y >= 1) {
        return [(x - y) / 2, 0, (x - y) / 2 + y, y];
    } else return [0, 0, 100, 100];
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
// ============================= OLD OLD OLD CODE ==============================
// function getTrainingData(cb) {
//     tdb.ref("config").once("value", config => {
//         cb([SELECTED_CLASSES, SELECTED_DATA], [tcnfg.testSplit, tcnfg.learningRate, tcnfg.epochs, tcnfg.minAccuracy, tcnfg.maxLoss]);
//     });
// }
// function updateConfidences(confs, cb) { // TODO: UPDATE TO HAVE ANY # OF CONFIDENCES
//     console.log("\n"+"Updating confidences; warriorii to " + warriorii + ", tree to " + tree + ", & triangle to " + triangle + ".");
//     db.ref("users/" + user + "/latestConfidences").set({
//         "warriorii": warriorii,
//         "tree": tree,
//         "triangle": triangle
//     }, () => {
//         if (cb) cb();
//     });
// }
// ========================== TENSORFLOW.JS FUNCTIONS ==========================
// async function iris() { // The main function of the Iris demo.
//     const [xTrain, yTrain, xTest, yTest] = getIrisData(0.15);
//     document.getElementById('train-from-scratch').addEventListener('click', async () => {
//         model = await trainModel(xTrain, yTrain, xTest, yTest);
//         evaluateModelOnTestData(model, xTest, yTest);
//     });
//     status('Standing by.');
//     wireUpEvaluateTableCallbacks(() => predictOnManualInput(model));
// }

// function trainModel(cb) {
//     var time = Date.now();
//     canPredict = false;
//     console.log("\n"+"Training model with training data...");
//     var trainData = getTrainingData();
//     console.log("\n"+trainData);
//     // TODO: PUT IN CODE FOR TRAINING MODEL
//     // iris();
//     console.log("\n"+"Finished training model in " + (Date.now() - time) + "ms!");
//     canPredict = true;
//     if (cb) cb();
// }

// function runTensorflow(data, image, cb) {
//     if (!canPredict) console.log("\n"+"Model training is not complete; trying later...");
//     else {
//         var time = Date.now();
//         console.log("\n"+"Running Tensorflow @ " + (new Date(time)).toLocaleTimeString() + " with data:", data);
//         getConfidences(model, data).then(confs => {
//             console.log("\n"+"Finished Running Tensorflow with: ");
//             updateConfidences(confs, cb);
//         });
//     }
// }

// tdb.ref("config").once("value", cnfg => {
//     config = cnfg.val();
//     types = config.types;
//     stype = config.training.data;
//     tcnfg = config.training[config.training.config + "Training"];
//     poseIndex = (Object.values(config.poseIndex)).sort().reduce((accumulator, currentValue, currentIndex, array) => {
//         accumulator[Object.keys(config.poseIndex)[Object.values(config.poseIndex).indexOf(array[currentIndex])]] = array[currentIndex];
//         return accumulator;
//     }, {});
// });

// ==================== APP HANDLING PROCESSING FUNCTIONS ====================
// function loopRunUpload() {
//     if (Object.values(users).every(x => x.updating == false)) loopRunUpload();
//     else handleAppDataUpdating(Date.now(), loopRunUpload);
// }

// function loopRunOpenPoseUpload(time) {
//     handleAppDataUpdating(time, () => {
//         if (Object.values(users).every(x => x.updating == false)) loopRunOpenPoseUpload(time);
//         else runOpenPose("./processing", "./processing/processed", loopRunOpenPoseUpload);
//     });
// }

// function handleAppDataUpdating(time, cb) {
//     var completion = {};
//     fs.readdir("./processing", (err, files) => {
//         files = files.filter(word => word.includes("."));
//         files.forEach(file => {
//             completion[file.slice(0, -(path.extname(file).length))] = false;
//         });
//         files.forEach(file => {
//             var ext = path.extname(file);
//             var key = file.slice(0, -(ext.length));
//             console.log("\n"+"Starting file read for user " + key + " after " + (Date.now() - time) + "ms...");
//             if (!users[key]) {
//                 completion[key] = true;
//                 checkReqComplete(completion, () => {
//                     console.log("\n"+"No users...");
//                     cb();
//                 });
//             } else if (!users[key].updating) {
//                 completion[key] = true;
//                 checkReqComplete(completion, () => {
//                     console.log("\n"+"No users are updating...");
//                     cb();
//                 });
//             } else fs.readFile("./processing/processed/" + key + "_keypoints.json", 'utf8', (err, data) => {
//                 console.log("\n"+"JSON file read for user " + key + " finished in " + (Date.now() - time) + "ms. Processing images...");
//                 console.log("\n"+"1");
//                 if (!data) {
//                     console.log("\n"+"2");
//                     completion[key] = true;
//                     checkReqComplete(completion, () => {
//                         console.log("\n"+"No data in json...");
//                         cb();
//                     });
//                 } else {
//                     console.log("\n"+"3");
//                     var openPoseData = extractData(JSON.parse(data));
//                     if (openPoseData[0].every(x => x === -1)) openPoseData[0] = getCenter(users[key].dimensions);
//                     else console.log("\n"+"Openpose successfully found a whole person for user " + key + "!");
//                     processUploadAppData(key, ext, openPoseData, {}, time, () => {
//                         console.log("\n"+"4");
//                         completion[key] = true;
//                         checkReqComplete(completion, () => {
//                             console.log("\n"+"5");
//                             console.log("\n"+"Finished updating all files in " + (Date.now() - time) + "ms");
//                             cb();
//                         });
//                     });
//                 }
//             });
//         });
//     });
// }

// function processUploadAppData(key, ext, openPoseData, newData, time, cb) {
//     imageProcessing("./processing/" + key + ext, openPoseData[0][0], openPoseData[0][1], openPoseData[0][2], openPoseData[0][3], (errA, trainingImage) => {
//         openPoseFrameProcessing("./processing/processed/" + key + "_rendered.png", users[key].dimensions, (errB, openposeImage) => {
//             console.log("\n"+errA, errB);
//             console.log("\n"+"Finished processing user " + key + " images in " + (Date.now() - time) + "ms. Uploading data...");
//             newData["lastUpdated"] = Date.now();
//             newData["latestOpenPoseFrame"] = openposeImage;
//             newData["latestTensorData/latestProcessedFrame"] = trainingImage;
//             for (var type in openPoseData)
//                 if (type > 0) newData["latestTensorData/datatype" + type] = openPoseData[type];
//             adb.ref("users/" + key).update(newData, err => {
//                 console.log("\n"+"Finished uploading user " + key + " data after " + (Date.now() - time) + "ms.");
//                 cb();
//             });
//         });
//     });
// }

// function checkReqComplete(check, cb) {
//     for (const done of Object.keys(check))
//         if (!check[done]) return;
//     cb();
// }