//const { parentPort, workerData } = require("worker_threads");

const JSONDecode = require("./jsondecode");

process.on("message", (msg) => {
    const { Opcode, Data } = JSONDecode(Buffer.from(msg?.data));

    switch (Opcode) {
        case "START": {
            const workerData = JSONDecode(Data);
            const Browser = require("./browser");
            Browser(workerData.config, workerData.model, workerData.appconfig, workerData.browserScripts, workerData.ROAMING_DIR, workerData.__appdir, workerData.AccountInfo, workerData.x, workerData.p);
            break;
        }
        default:
            break;
    }
})
