// ============================= IGNORE SETUP CODE =============================
if (document.addEventListener) document.addEventListener("DOMContentLoaded", autorun, false);
else if (document.attachEvent) document.attachEvent("onreadystatechange", autorun);
else window.onload = autorun;
firebase.initializeApp({
    apiKey: "AIzaSyBfzO0wkhLUX0sSKeQi1d7uMvvJrf7Ti4s",
    databaseURL: "https://yoga-master-training-db.firebaseio.com",
    projectId: "yoga-master-training-db"
});
var poseIndex;
var db = firebase.database();
var oldConsoleLog = console.log;
var showGraphs;
var show = true;

function toggleGraph() {
    show = !show;
    if (showGraphs.checked) document.getElementById("horizontal-section").style.display = "block";
    else document.getElementById("horizontal-section").style.display = "none";
}

function autorun() {
    showGraphs = document.getElementById("showGraphs");
    showGraphs.disabled = false;
    window['console']['log'] = function () {
        for (var i = 0; i < arguments.length; i++) {
            oldConsoleLog(arguments[i]);
            document.getElementById('demo-status').innerHTML += (typeof arguments[i] === 'string' ?
                arguments[i] : JSON.stringify(arguments[i])) + "<br>";
        }
        document.getElementById('demo-status').innerHTML += "<br>";
    };
}

function getTrainingData(cb) {
    db.ref("config").once("value", config => {
        config = config.val();
        poseIndex = (Object.values(config.poseIndex)).sort().reduce((accumulator, currentValue,
            currentIndex, array) => {
            accumulator[Object.keys(config.poseIndex)[Object.values(config.poseIndex).indexOf(
                array[currentIndex])]] = array[currentIndex];
            return accumulator;
        }, {});
        var tcnfg = config.training[config.training.config + "Training"];
        cb([SELECTED_CLASSES, SELECTED_DATA], [tcnfg.testSplit, tcnfg.learningRate, tcnfg.epochs, tcnfg
            .minAccuracy, tcnfg.maxLoss
        ]);
    });
}
// ============================ MODEL TRAINING CODE ============================
var time = Date.now(); // The start time of everything
let model; // A global variable for holding the model
getTrainingData((tdbdata, tdbconfig) => { // Downloading data live to train on
    console.log("AFTER " + (Date.now() - time) + "MS, MAIN DOWNLOAD_DATA: ", tdbdata[0], tdbdata[1].length +
        " rows X " + tdbdata[1][0].length + " columns.");
    getTrainedModel(tdbdata, tdbconfig).then(mdl => { // Calling the train model function and logging the results
        model = mdl.model;
        var acc = mdl.accuracy;
        var los = mdl.loss;
        console.log("AFTER " + (Date.now() - time) + "MS, MAIN MODEL:" + model, "ACCURACY: " +
            acc + (acc >= tdbconfig[3] ? " → ✓" : " → ✖"), "LOSS: " + los + (los <=
                tdbconfig[4] ? " → ✓" : " → ✖"));
        getConfidences(model, tdbdata[1][0].slice(0, -1)).then(confs => { // Making a prediction using the model and first row of tdbdata
            confs.push(Object.keys(poseIndex)[confs.indexOf(Math.max.apply({}, confs))]);
            console.log("AFTER " + (Date.now() - time) + "MS, MAIN RUNNER 1: ", confs,
                tdbdata[1][0]);
        });
        getConfidences(model, [90, -90, 22, -25, -41, 55, 15, -14, 35, -33, 45, -43, 0.3172,
            0.3201, 0.2187, 0.2337, 0.1295, 0.122, 0.0808, 0.0815, 0.3194, 0.3252,
            0.5853, 0.5967, 1.0151, -0.4198, 1.0152, -0.3277, 0.9071, -0.3278, 0.835, -
            0.1719, 0.927, -0.108, 1.1231, -0.3276, 1.187, -0.168, 1.1269, -0.0996,
            0.9392, -0.0118, 0.7953, 0.208, 0.6113, 0.4078, 1.099, -0.0158, 1.2469,
            0.196, 1.4349, 0.384
        ]).then(confs => { // Making a prediction using the model and first row of tdbdata
            confs.push(Object.keys(poseIndex)[confs.indexOf(Math.max.apply({}, confs))]);
            console.log("AFTER " + (Date.now() - time) + "MS, MAIN RUNNER 2: ", confs, [
                90, -90, 22, -25, -41, 55, 15, -14, 35, -33, 45, -43, 0.3172,
                0.3201, 0.2187, 0.2337, 0.1295, 0.122, 0.0808, 0.0815, 0.3194,
                0.3252, 0.5853, 0.5967, 1.0151, -0.4198, 1.0152, -0.3277,
                0.9071, -0.3278, 0.835, -0.1719, 0.927, -0.108, 1.1231, -0.3276,
                1.187, -0.168, 1.1269, -0.0996, 0.9392, -0.0118, 0.7953, 0.208,
                0.6113, 0.4078, 1.099, -0.0158, 1.2469, 0.196, 1.4349, 0.384
            ]);
        });
        console.log("Finially finished in " + (Date.now() - time) + "ms.");
    });
});
// ============================ OLD TRAINING DATA GET CODE ============================
// function getTrainingData(cb) {
//     db.ref("config").once("value", config => {
//         config = config.val();
//         selectedType = config.training.data;
//         poseIndex = (Object.values(config.poseIndex)).sort().reduce((accumulator, currentValue, currentIndex, array) => {
//             accumulator[Object.keys(config.poseIndex)[Object.values(config.poseIndex).indexOf(array[currentIndex])]] = array[currentIndex];
//             return accumulator;
//         }, {});
//         types[selectedType] = config.types[selectedType];
//         var tcnfg = config.training[config.training.config + "Training"];
//         db.ref("frames").once("value", snap => {
//             var data = snap.val();
//             var trainingData = {};
//             for (const type in types) trainingData[type] = [];
//             for (const key of Object.keys(data))
//                 for (const type in types)
//                     if (data[key][type] && !(data[key][type] == 0 || data[key][type] == 1)) {
//                         data[key][type].push(poseIndex[data[key].pose]);
//                         trainingData[type].push(data[key][type]);
//                     }
//             for (const type in types) trainingData[type + "_CLASSES"] = Object.keys(poseIndex);
//             cb([trainingData[selectedType + "_CLASSES"], trainingData[selectedType]], [tcnfg.testSplit, tcnfg.learningRate, tcnfg.epochs, tcnfg.minAccuracy, tcnfg.maxLoss]);
//         });
//     });
// }