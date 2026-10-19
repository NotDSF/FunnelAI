process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1"

const isForked = typeof process.send === "function"
if (isForked) {
  require("./modules/worker");
  return;
}

console.log(`Node ${process.version} is ${process.arch}`);


const { mkdirSync, existsSync, writeFileSync, rmSync, createWriteStream, readFileSync, copyFileSync } = require("node:fs"); 
const { app, BrowserWindow, dialog, ipcMain, shell, session, powerSaveBlocker, clipboard, Menu } = require("electron");
const os = require("node:os");

const totalMB = Math.floor(os.totalmem() / 1024 / 1024);
const maxHeapMB = Math.min(Math.floor(totalMB / 2), 16 * 1024);

Menu.setApplicationMenu(null);
app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${maxHeapMB}`);
app.disableHardwareAcceleration();

const { pipeline } = require("node:stream");
const { execSync, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const path = require("node:path");
const streamPipeline = promisify(pipeline);
const ROAMING_DIR = app.getPath("userData");

if (!app) {
    return;
}

const pdidd = powerSaveBlocker.start("prevent-display-sleep");
const util = require("node:util");
const zlib = require("node:zlib");
const zinflate = util.promisify(zlib.inflate);

// app.isPackaged Readonly

let __appdir = app.getAppPath();
if (app.isPackaged) {
    __appdir = path.normalize(__appdir + "../../../");
}

globalThis.__appdir = __appdir;
globalThis.ROAMING_DIR = ROAMING_DIR;

require("./modules/storage");

const logtail = require("./modules/logtail");
const fastify = require("fastify")();
const cors = require("@fastify/cors");
const UserAgent = require("user-agents");
const StreamZip = require("node-stream-zip");
const appconfig = JSON.parse(readFileSync(`${__appdir}/storage/app.json`, "utf-8"));
const dataStorage = require("./modules/dataStorage");
const adsPowerDeserialize = require("./modules/adsPowerDeserialize");
//const SnapchatBrowser = require("./modules/browser");
//const InstagramBrowser = require("./modules/instagram");
const proxy = require("./modules/proxy");
//const AIClass = require("./modules/AI");
const HWID = require("./modules/HWID");
const CustomJSON = require("./modules/json");
const JSONDecode = require("./modules/jsondecode");
const { fork } = require('child_process');

const DataStorage = new dataStorage();
let CURRENT_VERSION = "v3.2.2"
const VERSION_HASH = "U76cJyUg0wDNEM";
const CheckProxy = new proxy();
const AIResponsePromises = new Map();
const IgnoreLists = {};
const models = {};
const browserScripts = {};
let BrowserStates = {};
let configs = {};

let BrowserCommunication = {};
let BrowserCommunicationMap = new Map();
let BrowserOpenStatus = {};
//const appconfig = {};


//globalThis.IgnoreLists = IgnoreLists;

let AccountInfo;
let LoginToken;
let WebsocketConnected;
let SendWebsocket;
let DeviceName;
let DeviceID;
let UserAPIKey;
let LastServerPing;
let GenerateBrowserConfig;
let DeveloperFlagNoDownload;
let LastServerSynced;

let FASTIFY_PORT;

appconfig.version = CURRENT_VERSION;
//globalThis.appconfig = appconfig;

function SaveConfig() {
    DataStorage.WriteFile(path.join(__appdir, "/storage/configs.bin"), CustomJSON(configs));
}

function SaveConfigs() {
    DataStorage.WriteFile(path.join(__appdir, "/storage/configs.bin"), CustomJSON(configs));
}

function SaveAppConfig() {
    writeFileSync(path.join(__appdir, "/storage/app.json"), JSON.stringify(appconfig));
}

function SetBrowserState(ID, Enabled) {
    BrowserStates[ID] = Enabled;
    writeFileSync(path.join(__appdir, "storage/state.json"), JSON.stringify(BrowserStates));
}

function ResetBrowserStates() {
    writeFileSync(path.join(__appdir, "storage/state.json"), JSON.stringify({}));
}

async function wait(ms) {
    await new Promise(async (resolve, reject) => setTimeout(resolve, ms));
}

function AICreateResponse(Messages, Settings, IncludeMoreMessages) {
    if (!SendWebsocket) {
        throw "Websocket not initialized 0x1";
    }

    for (const message of Messages) {
        delete message.messageId;
    }

    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });

    const UUID = crypto.randomUUID();
    AIResponsePromises.set(UUID, resolve);
    SendWebsocket({ Opcode: 6, Data: { UUID, Messages: Messages.slice(IncludeMoreMessages ? -100 : -25), Settings } });
    return promise;
}

function AIDetermineStage(Messages, Settings) {
    if (!SendWebsocket) {
        throw "Websocket not initialized 0x2";
    }

    for (const message of Messages) {
        delete message.messageId;
    }

    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });

    const UUID = crypto.randomUUID();
    AIResponsePromises.set(UUID, resolve);
    SendWebsocket({ Opcode: 8, Data: { UUID, Messages: Messages.slice(-25), Settings } });
    return promise;
}

function AIDetermineImage(Images, Messages, SentImages) {
    if (!SendWebsocket) {
        throw "Websocket not initialized 0x3";
    }

    for (const message of Messages) {
        delete message.messageId;
    }

    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });

    const UUID = crypto.randomUUID();
    AIResponsePromises.set(UUID, resolve);
    SendWebsocket({ Opcode: 9, Data: { UUID, Messages: Messages.slice(-25), Images, SentImages } });
    return promise;
}

/*
const wss = new WebSocketServer({
    port: 8081
});

wss.on("listening", () => console.log("Websocket Server listening to port 8081"));
*/

let ElectronWindow;
let AlreadyLaunched = new Set();

function LaunchBrowser(config, model, ignorelist, IgnoreWarnings) {
    if (!ignorelist) {
        if (!IgnoreWarnings) {
            createNotification({
                title: "FunnelAI",
                message: ("There isn't a model configured to this browser"),
                type: "warning"
            });
        }
        return;
    }

    if (AlreadyLaunched.has(config.id)) {
        return;
    }

    SetBrowserState(config.id, true);
    AlreadyLaunched.add(config.id);

    const worker = fork(path.resolve(__dirname, app.isPackaged ? "app.js" : "index.js"), [])

    function SendToWorker(data) {
        try {
            worker.send(CustomJSON(data));
        } catch (er) {
            console.log(er);
        }
    }

    SendToWorker({
        Opcode: "START",
        Data: CustomJSON({ config, model, appconfig, browserScripts, ROAMING_DIR, __appdir, AccountInfo, x: Date.now() / 1000, p: FASTIFY_PORT })
    });

    BrowserOpenStatus[config.id] = {
        BrowserOpen: false,
        LoggedInTime: false,
        LoggedIn: false,
        BrowserOpenTime: Date.now()
    }
    /*
    {
        workerData: { config, model, ignorelist, appconfig, browserScripts, ROAMING_DIR, __appdir },
        execArgv: [`--max-old-space-size=${maxHeapMB}`]
    }
    */
    worker.on("message", (value) => {
        let Decrypted;
        try {
            Decrypted = JSON.parse(value);
        } catch (er) {
            console.log(er);
            return;
        }
        
        if (typeof(Decrypted) !== "object") {
            return;
        }

        const { Opcode, Data } = Decrypted;
        switch (Opcode) {
            case "ICPBroadcast": {
                ICPSendToMain(Data);
                break;
            }
            case "SHARED": {
                BrowserCommunicationMap.get(Data.UUID)(Data.Data);
                BrowserCommunicationMap.delete(Data.UUID);
                break;
            }
            case "createNotification": {
                createNotification(Data);
                break;
            }
            case "WSC": {
                SendWebsocket(Data);
                break;
            }
            case "CONFIG": {
                if (typeof Data !== "object") {
                    break;
                }

                const { chats, analytics, last_login, persistent_tabs, cache, add_friends_next_cycle, cookies } = Data;
                const cf = configs[config.id];
                cf.chats = chats;
                cf.analytics = analytics;
                cf.last_login = last_login;
                cf.persistent_tabs = persistent_tabs;
                cf.cache = cache;
                cf.bot_settings.add_friends_next_cycle = add_friends_next_cycle;
                cf.cookies = cookies;
                break;
            }
            case "CreateResponse": {
                AICreateResponse(Data.Messages, Data.Settings, Data.IncludeMoreMessages)
                .then((value) => {
                    try {
                        SendToWorker({ Opcode: "ASYNC_RESPONSE", Data: { Data: value, UUID: Data.UUID } })
                    } catch (er) {
                        console.log(er.toString());
                    }
                })
                .catch(er => console.log(er));
                break;
            }
            case "DetermineStage": {
                AIDetermineStage(Data.Messages, Data.Settings)
                .then((value) => {
                    try {
                        SendToWorker({ Opcode: "ASYNC_RESPONSE", Data: { Data: value, UUID: Data.UUID } });
                    } catch (er) {
                        console.log(er.toString());
                    }
                })
                .catch(er => console.log(er));
                break;
            }
            case "DetermineImage": {
                AIDetermineImage(Data.Images, Data.Messages, Data.SentImages)
                .then((value) => {
                    try {
                        SendToWorker({ Opcode: "ASYNC_RESPONSE", Data: { Data: value, UUID: Data.UUID } })
                    } catch (er) {
                        console.log(er.toString());
                    }
                })
                .catch(er => console.log(er));
                break;
            }
            case "OpenWindow": {
                const { ID } = Data;
                const datac = configs[ID];
                if (!datac) {
                    return;
                }

                const platform = datac.platform || "snapchat";
                switch (platform) {
                    case "snapchat":
                        ElectronWindow.loadURL("http://127.0.0.1:8081/dist/browser?id=" + ID);
                        break;
                    case "instagram":
                        ElectronWindow.loadURL("http://127.0.0.1:8081/dist/browserinstagram?id=" + ID);
                        break;
                    default:
                        break;
                }

                ElectronWindow.show();
                break;
            }
            case "ENABLE_BOT": {
                const { ID, Enabled } = Data;
                const datac = configs[ID];
                if (!datac) {
                    return;
                }

                datac.bot_settings.enabled = Enabled;
                break;
            }
            case "ENABLE_FRIENDS_TASK": {
                const { ID, Enabled } = Data;
                const datac = configs[ID];
                if (!datac) {
                    return;
                }

                datac.bot_settings.enable_friend_task = Enabled;
                break;
            }
            case "BROWSER_OPEN": {
                BrowserOpenStatus[config.id].BrowserOpen = true;
                break;
            }
            case "LOGGED_IN_STATUS": {
                const { LoggedIn } = Data;

                if (LoggedIn) {
                    BrowserOpenStatus[config.id].LoggedIn = true;
                    BrowserOpenStatus[config.id].LoggedInTime = Date.now();
                } else {
                    BrowserOpenStatus[config.id].LoggedIn = false;
                    BrowserOpenStatus[config.id].LoggedInTime = false;
                }
                break;
            }
            case "IS_IGNORED": {
                const { username, UUID } = Data;
                SendToWorker({ Opcode: "ASYNC_RESPONSE", Data: { Data: ignorelist.has(username), UUID } })
                break;
            }
            default:
                console.log(Decrypted);
                break;
        }
    });

    worker.on("error", (err) => {
        console.log(err);
    });

    let SyncBotSettingsInterval;
    SyncBotSettingsInterval = setInterval(() => {
        if (!worker.connected) {
            return;
        }

        try {
            SendToWorker({ Opcode: "BOT_SETTINGS", Data: { bot_settings: configs[config.id].bot_settings, model: models[configs[config.id].bot_settings.selected_model] } });
        } catch (er) {
            console.log(er);
        }
    }, 1000)

    worker.on("exit", (code) => {
        console.log("fork exit, code:", code);
        BrowserOpenStatus[config.id] = {
            BrowserOpen: false,
            LoggedInTime: false,
            LoggedIn: false
        }

        AlreadyLaunched.delete(config.id);
        clearInterval(SyncBotSettingsInterval);
        if (code === 0) {
            SetBrowserState(config.id, false);
        } else {
            LaunchBrowser(config, model, ignorelist, IgnoreWarnings); // relaunch after crash
        }
    });

    BrowserCommunication[config.id] = {
        sendMessage: function (Data) {
            if (!worker.connected) {
                return;
            }

            try {
                SendToWorker(Data);
            } catch (er) {
                console.log(er);
            }
        },
        sendMessageAsync: function(Data) {
            if (!worker.connected) {
                return {};
            }
            
            try {
                let resolve;
                const promise = new Promise((res) => {
                    resolve = res;
                });

                const UUID = crypto.randomUUID();
                BrowserCommunicationMap.set(UUID, resolve);
                SendToWorker({ Opcode: "SHARED", Data: { UUID, Data } });
                return promise;
            } catch (er) {
                logtail.log(er.toString());
            }
        }
    }

    /*
    switch (config.platform) {
        case "instagram": {
            InstagramBrowser(config, model, ignorelist, shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
            break;
        }
        default:
            SnapchatBrowser(config, model, ignorelist, shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
            break;
    }
        */
}

const PowershellPath = path.join(process.env.SystemRoot || "C:\\WINDOWS", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
function RunPowershell(command) {
    return execSync(`"${PowershellPath}" -ExecutionPolicy Bypass -Command ${command}`);
}

try {
    execSync(`"${PowershellPath}" -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -match 'FunnelAI|FunnelBot' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`);
} catch (er) {
    console.log(er);
}

async function SyncConfigsToServer(configs, DeviceID, APIKey) {
    try {
        const encrypted = DataStorage.EncryptBufferToBuffer(CustomJSON(configs), APIKey);
        const packet = await fetch(`http://127.0.0.1:8081/api/user/device/${DeviceID}/config`, {
            method: "PUT",
            headers: {
                ["Authorization"]: APIKey,
                ["Content-Type"]: 'application/octet-stream',
                ["Content-Length"]: encrypted.length
            },
            body: encrypted
        });

        if (packet.status === 200) {
            LastServerSynced = Date.now();

            ElectronWindow.webContents.send("reply", {
                Opcode: "BROWSERS_SYNCED",
                Data: LastServerSynced
            });
        }
    } catch (er) {
        console.log(er);
    }
}

async function SendDeviceFarmingStats(DeviceID, APIKey) {
    try {
        let data = {
            friends: 0,
            messages: 0,
            images: 0,
            cta_link_shared: 0,
            cta_link_subscribed: 0,
            all_friends: 0,
            conversations: 0
        }

        for (const cfg of Object.values(configs)) {
            for (const [x, y] of Object.entries(cfg.analytics)) {
                data[x] += y.total;
            }
        }

        await fetch(`http://127.0.0.1:8081/api/user/device/${DeviceID}/stats`, {
            method: "POST",
            headers: {
                ["Authorization"]: APIKey,
                ["Content-Type"]: 'application/json',
            },
            body: JSON.stringify(data)
        });
    } catch (er) {
        console.log(er);
    }
}

async function CreateWindow() {
    const win = new BrowserWindow({
        width: 552,
        height: 130, // 180
        title: "FunnelAI",
        alwaysOnTop: appconfig.top_most,
        icon: path.join(__appdir, "src/public/logo.png"),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__appdir, "src/public/preload.js"),
            devTools: true,
            spellcheck: false
        }
    });
    ElectronWindow = win;

    {
        try {
            const IntegrityCheck = await fetch("http://127.0.0.1:8081/api/");
            if (IntegrityCheck.status !== 200) {
                dialog.showMessageBoxSync(ElectronWindow, {
                    title: "FunnelAI (Service Unavailable)",
                    message: `FunnelAI API Timeout (${IntegrityCheck.status})\n\nPossible Causes:\n- You're using a VPN or Proxy Server\n- Server Downtime / Maintence\n- Cloudflare / Upstream Outage\n- No Internet Connection\n\nIf your internet connection is working, check our Telegram channel for more updates. (https://t.me/funnelai)`,
                    type: "error"
                });
                process.exit(0);
                return;
            }
        } catch (er) {
            dialog.showMessageBoxSync(ElectronWindow, {
                title: "FunnelAI (Service Unavailable)",
                message: `FunnelAI API Timeout\n\nPossible Causes:\n- You're using a VPN or Proxy Server\n- Server Downtime / Maintence\n- Cloudflare / Upstream Outage\n- No Internet Connection\n\nIf your internet connection is working, check our Telegram channel for more updates. (https://t.me/funnelai)`,
                type: "error"
            });
            process.exit(0);
            return;
        }
    }

    win.webContents.on("before-input-event", (event, input) => {
        if (input.control || input.meta) {
            const lkey = input.key.toLowerCase();
            if (lkey === "r") {
                win.reload();
                event.preventDefault();
            }

            if (input.shift && lkey === "i") {
                event.preventDefault();

                if (!AccountInfo) {
                    return;
                }

                if (!AccountInfo["Admin"]) {
                    return;
                }

                win.webContents.toggleDevTools();
            }
        }
    });

    win.on("focus", () => {
        if (appconfig.focus_based_opacity) {
            win.setOpacity(1);
        }
    });

    // Detect when window loses focus
    win.on("blur", () => {
        if (appconfig.focus_based_opacity) {
            win.setOpacity(0.4);
        }
    });

    await session.defaultSession.cookies.set({
        url: "http://127.0.0.1:8081",
        name: "port",
        value: FASTIFY_PORT.toString()
    });

    await win.loadURL(("http://127.0.0.1:8081/dist/loading"));

    globalThis.createNotification = (options) => {
        dialog.showMessageBox(ElectronWindow, options);
    }

    //win.loadFile("src/public/loading.html")

    let Quitting;
    win.on("close", async (e) => {
        if (Quitting) {
            return;
        }

        e.preventDefault();

        if (UserAPIKey) {
            SaveConfigs();
        }

        let OpenCount = 0;
        for (const id of Object.keys(configs)) {
            const shared = BrowserOpenStatus[id]; 
            if (shared) {
                if (shared && shared?.BrowserOpen) {
                    OpenCount++;
                }
            }
        }

        if (OpenCount > 0) {
            const result = dialog.showMessageBoxSync(win, {
                title: `FunnelAI`,
                type: "warning",
                message: `There are ${OpenCount} browser instances currently open. Do you really want to exit?`,
                buttons: ["Yes", "No"]
            });

            if (result === 0) {
                for (const id of Object.keys(configs)) {
                    const shared = BrowserCommunication[id]; 
                    const OpenData = BrowserOpenStatus[id]; 
                    if (shared && OpenData) {
                        if (OpenData && OpenData?.BrowserOpen) {
                            shared.sendMessage({ Opcode: "KILL_BROWSER", Data: {} })
                            SetBrowserState(id, false);
                        }
                    }
                }

                try {
                    execSync(`powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'chrome.exe' -and $_.CommandLine -like '*browser-states*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`);
                } catch (er) {
                    console.log(er);
                }
                
                
                Quitting = true;
                app.quit();
            }
            return;
        }
        
        Quitting = true;
        app.quit();
    });
    
    ElectronWindow = win;

    
    try {
        const result = RunPowershell("(Get-ItemProperty -Path 'Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\X64' -Name 'Installed').Installed").toString();
        if (result.trim() !== "1") {
            dialog.showMessageBoxSync(ElectronWindow, {
                title: "FunnelAI",
                message: "Visual C++ Redistributable (vc_redist.x64.exe) is missing.\nPlease click OK to download it from the official Microsoft website.",
                buttons: ["OK"]
            });
            await shell.openExternal("https://aka.ms/vs/17/release/vc_redist.x64.exe");
            app.exit();
        }
    } catch (er) {
        dialog.showMessageBoxSync(ElectronWindow, {
            title: "FunnelAI",
            message: "Failed to install Visual C++ Redistributable (vc_redist.x64.exe)\nEnsure you have a web browser downloaded.",
            buttons: ["OK"]
        });
        app.exit();
    }

    ElectronWindow.webContents.send("reply", {
        Opcode: "LOADING_STATUS",
        Data: {
            Text: "Checking Account...",
            Amount: 25
        }
    });

    if (!existsSync(path.join(ROAMING_DIR, "user.bin"))) {
        await win.setBounds({ width: 700, height: 600 });
        await win.loadURL(("http://127.0.0.1:8081/dist/login"));
        //win.loadFile(path.join(__appdir, "src/public/login.html"));
        return;
    }

    let APIKey;
    try {
        APIKey = DataStorage.ReadFile(path.join(ROAMING_DIR, "user.bin"));
    } catch {
        rmSync(path.join(ROAMING_DIR, "user.bin"));
        app.relaunch({ args: [] });
        app.quit();
        return;
    }

    console.log(APIKey);
     
    //const APIKey = readFileSync(path.join(ROAMING_DIR, "user.bin"), "utf-8");
    const result = await fetch(("http://127.0.0.1:8081/api/auth/") + `${APIKey}/1`);
    console.log(result)
    if (result.status === 501) {
        dialog.showMessageBoxSync(ElectronWindow, {
            title: "FunnelAI",
            type: "warning",
            message: ("FunnelAI is currently down for maintenance.\nWe will alert you when we're back up.\n\nFor in-depth updates check out our telegram channel")
        });
        app.exit();
        return;
    }

    if (result.status !== 200) {
        await win.setBounds({ width: 700, height: 600 });
        await win.loadURL(("http://127.0.0.1:8081/dist/login"));
        //win.loadFile(path.join(__appdir, "src/public/login.html"));
        return;
    }

    const rawJSONText = await result.arrayBuffer();
    AccountInfo = JSONDecode(Buffer.from(rawJSONText));
    UserAPIKey = APIKey;

    if (AccountInfo[("Admin")]) {
        console.log(`PSB: ${powerSaveBlocker.isStarted(pdidd)}`);
    }

    if (appconfig.developer_mode?.enabled && !AccountInfo[("Admin")]) {
        appconfig.developer_mode.enabled = false;
    }

    /*
    if (AccountInfo[("SubscriptionType")] == ("expired")) {
        dialog.showMessageBoxSync(win, {
            title: `FunnelAI`,
            type: "warning",
            message: ("Your subscription has expired.\nUpgrade your subscription on our dashboard (funnelai.bot) to keep using our software"),
        });
        app.exit();
        return;
    }
        */

    /*
    if (AccountInfo[("SubscriptionType")] !== ("paid") && AccountInfo[("SubscriptionType")] !== ("trial")) {
        app.exit();
        return;
    }

    */

    await session.defaultSession.cookies.set({
        url: "http://127.0.0.1:8081",
        name: "authorization",
        value: APIKey
    });
    logtail.setAuth(APIKey);

    if (existsSync(`${__appdir}/storage/configs.bin`)) {
        try {
            configs = JSONDecode(DataStorage.ReadFileBuffer(`${__appdir}/storage/configs.bin`));
        } catch (er) {
            console.log(er);
            dialog.showMessageBoxSync(win, {
                title: `FunnelAI`,
                type: "error",
                message: `Your configuration file is corrupted, which means we're unable to load your current settings.\nIf you'd like to attempt data recovery, please contact a developer.`
            });
            copyFileSync(`${__appdir}/storage/configs.bin`, `${__appdir}/storage/config-backup.bin`);
            app.relaunch({ args: [] });
            app.exit();
            return;
        }
    }

    if (!configs) {
        configs = {};
    }

    /*
    if (!existsSync(path.join(__appdir, "Relauncher.exe"))) {
        ElectronWindow.webContents.send("reply", {
            Opcode: "LOADING_STATUS",
            Data: {
                Text: "Downloading Relauncher",
                Amount: 50
            }
        });
    
        const packet = await fetch(("https://funnelai.bot/dist/relauncher.exe"), {
            method: "GET",
            headers: {
                ["Authorization"]: UserAPIKey
            }
        });

        let downloadedBytes = 0;

        const fileStream = createWriteStream(path.join(__appdir, "Relauncher.exe"));
        const nodeReadable = Readable.fromWeb(packet.body);

        nodeReadable.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const downloadedKB = (downloadedBytes / 1024).toFixed(1);

            ElectronWindow.webContents.send("reply", {
                Opcode: "LOADING_STATUS",
                Data: {
                    Text: `Downloading Relauncher [${downloadedKB}KB]`,
                    Amount: 50
                }
            });
        });

        await streamPipeline(nodeReadable, fileStream);
    }
        */

    try {
        BrowserStates = JSON.parse(readFileSync(path.join(__appdir, "storage/state.json"), "utf-8"));
    } catch (er) {
        console.log(er);
        BrowserStates = {};
    }

    const versionPacket = await fetch(("http://127.0.0.1:8081/api/app/version"), {
        method: "GET",
        headers: {
            ["Authorization"]: UserAPIKey
        }
    });

    const { tag_name } = await versionPacket.json();
    if (tag_name !== CURRENT_VERSION) {
        const packet = await fetch(("http://127.0.0.1:8081/api/app/download"), {
            method: "GET",
            headers: {
                ["Authorization"]: UserAPIKey
            }
        });

        const totalBytes = Number(packet.headers.get("content-length")) || 0;
        const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
        const reader = packet.body.getReader();
        let downloadedBytes = 0;
        let lastUpdate = 0;

        const fileStream = createWriteStream(path.join(__appdir, "/storage/temp.zip"));
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            fileStream.write(Buffer.from(value));
            downloadedBytes += value.length;

            const now = Date.now();
            if (now - lastUpdate > 350) {
                lastUpdate = now;
                const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(1);
                ElectronWindow.webContents.send("reply", {
                    Opcode: "LOADING_STATUS",
                    Data: {
                        Text: `Downloading Update [${downloadedMB}MB / ${totalMB}MB]`,
                        Amount: 50
                    }
                });
            }
        }

        await new Promise((resolve) => {
            fileStream.end(() => fileStream.close((err) => {
                if (err) {
                    console.log(err);
                    resolve();
                }
                resolve();
            }));
        });

        console.log("Finished");

        const zip = new StreamZip.async({ file: path.join(__appdir, "/storage/temp.zip") });

        ICPSendToMain({
            Opcode: "LOADING_STATUS",
            Data: {
                Text: "Unpacking Update...",
                Amount: 60
            }
        });
            
        await zip.extract("FunnelAI.exe", path.join(__appdir, "/storage/FunnelAI.tmp"));
        await zip.extract("app.asar", path.join(__appdir, "/storage/app.tmp"));
        await zip.close();

        rmSync(path.join(__appdir, "/storage/temp.zip"), { force: true });

        ICPSendToMain({
            Opcode: "LOADING_STATUS",
            Data: {
                Text: "Relaunching...",
                Amount: 100
            }
        });
        return;
    }

    /*
    if (!existsSync(path.join(__appdir, "/storage/chrome-win"))) {
        ElectronWindow.webContents.send("reply", {
            Opcode: "LOADING_STATUS",
            Data: {
                Text: "Downloading Dependencies",
                Amount: 50
            }
        });
    
        // http://127.0.0.1:8081/dist/chrome-win.zip
        const packet = await fetch(("https://funnelai.bot/dist/chrome-win.zip"), {
            method: "GET",
            headers: {
                ["Authorization"]: UserAPIKey
            }
        });

        const totalBytes = Number(packet.headers.get("content-length")) || 0;
        const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
        const reader = packet.body.getReader();
        let downloadedBytes = 0;
        let lastUpdate = 0;

        const fileStream = createWriteStream(path.join(__appdir, "/storage/temp.zip"));
        //const nodeReadable = Readable.fromWeb(packet.body);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            fileStream.write(Buffer.from(value));
            downloadedBytes += value.length;

            const now = Date.now();
            if (now - lastUpdate > 350) {
                lastUpdate = now;
                const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(1);
                ElectronWindow.webContents.send("reply", {
                    Opcode: "LOADING_STATUS",
                    Data: {
                        Text: `Downloading Dependencies [${downloadedMB}MB / ${totalMB}MB]`,
                        Amount: 50
                    }
                });
            }
        }

        await new Promise((resolve) => {
            fileStream.end(() => fileStream.close((err) => {
                if (err) {
                    console.log(err);
                    resolve();
                }
                resolve();
            }));
        });

        console.log("Finished");

        //await streamPipeline(packet.body, fileStream);
        const zip = new StreamZip.async({ file: path.join(__appdir, "/storage/temp.zip") });

        ElectronWindow.webContents.send("reply", {
            Opcode: "LOADING_STATUS",
            Data: {
                Text: "Unpacking Dependencies...",
                Amount: 60
            }
        });

        await zip.extract("chrome-win", path.join(__appdir, "/storage/chrome-win"));
        await zip.close();
        rmSync(path.join(__appdir, "/storage/temp.zip"), { force: true });
    }
        */

    for (const config of Object.values(configs)) {
        for (const [index, analytics] of Object.entries(config.analytics)) {
            if (Date.now() > analytics.next_update) {
                const Tmr = new Date();
                Tmr.setHours(Tmr.getHours() + 24);
                analytics.next_update = Tmr.getTime(); 
                analytics.today = 0;
                config.analytics[index] = analytics;
            }
        }
    }



    let FirstLaunch = true;
    // Called after the Socket has finished Initalising and UI open
    async function SocketFinished() {
        if (!FirstLaunch) {
            return;
        }
        FirstLaunch = false;

        console.log(("Running first launch process.argv tasks"));

        if (process.argv.includes("--update-complete")) {
            if (Object.values(BrowserStates).filter(x => x === true).length) {
                const result = dialog.showMessageBoxSync(ElectronWindow, {
                    title: "FunnelAI",
                    message: `${CURRENT_VERSION} has been installed successfully.\nWould you like to re-open your browsers?`,
                    buttons: ["Yes", "No"],
                    type: "question"
                });
                            
                if (result === 0) {
                    for (const [ID, Enabled] of Object.entries(BrowserStates)) {
                        if (configs[ID] && Enabled) {
                            LaunchBrowser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model]);
                            //await browser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
                            await wait(5000);
                        }
                    }
                }
            } else {
                dialog.showMessageBox(ElectronWindow, {
                    title: "FunnelAI",
                    message: `${CURRENT_VERSION} has been installed successfully.`,
                    buttons: ["OK"],
                    type: "info"
                });
            }
        }

        if (process.argv.includes("--recovery")) {
            for (const [ID, Enabled] of Object.entries(BrowserStates)) {
                if (configs[ID] && Enabled) {
                    console.log(ID, Enabled);
                    LaunchBrowser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model]);
                    //await browser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
                    await wait(5000);
                }
            }
        }

        if (!process.argv.includes("--update-complete") && !process.argv.includes("--recovery")) {
            ResetBrowserStates();
        }
    }

    let ReconnectionTimeoutID;

    function ConnectWebsocket() {
        if (ReconnectionTimeoutID) {
            console.log(("Cleared interval of ReconnectionTimeoutID"));
            clearInterval(ReconnectionTimeoutID);
        }

        const socket = new WebSocket(("ws://127.0.0.1:8081/ws/?authorization=") + APIKey + ("&a=") + VERSION_HASH); // wss://funnelai.bot/ws/?authorization=${APIKey}
        function send(obj) {
            if (!socket) {
                return;
            }
            if (socket.readyState !== WebSocket.OPEN) {
                return;
            }
            zlib.deflate(CustomJSON(obj), { level: zlib.constants.Z_BEST_SPEED }, (err, compressed) => {
                if (!err && socket) socket.send(compressed);
            });
        }
        SendWebsocket = send;

        let SyncIntervalID;
        let PingIntervalID;

        socket.addEventListener("error", (data) => {
            console.log("socket error", data);

            console.log(("Socket Error"));
            WebsocketConnected = false;
            clearInterval(SyncIntervalID);
            clearInterval(PingIntervalID);
            ReconnectionTimeoutID = setInterval(ConnectWebsocket, 5000);
            logtail.info("Socket Error");
        });

        socket.addEventListener("close", (event) => {
            console.log(("Socket Closed"));
            WebsocketConnected = false;
            clearInterval(SyncIntervalID);
            clearInterval(PingIntervalID);

            ReconnectionTimeoutID = setInterval(ConnectWebsocket, 5000);
            //setTimeout(ConnectWebsocket, 5000); // attempt reconnection in 5s
            logtail.info("Socket Closed");
        });

        /*
        socket.addEventListener("open", () => {
            LastServerPing = Date.now() / 1000;
        });
        */

        socket.addEventListener("message", async (event) => {
            let ParsedJSON;
            try {
                const decompressed = await zinflate(await event.data.arrayBuffer());
                ParsedJSON = JSONDecode(decompressed);
            } catch (er) {
                console.log(er);
                return;
            }

            if (!ParsedJSON || typeof ParsedJSON !== "object") {
                writeFileSync(path.join(__appdir, "error.dat"), "0x3434");
                return;
            }

            const { Opcode, Data } = ParsedJSON;
            switch (Opcode) {
                case 1: { // Connect (SERVER_CONNECTED First) First in chain.
                    LastServerPing = Date.now() / 1000;
                    const { Models, A, B } = Data;
                    AccountInfo = B;

                    for (const id of Object.keys(models)) {
                        if (!Models.find((x) => x.id === id)) {
                            delete models[id];
                        }
                    }
                    
                    for (const model of Models) {
                        if (models[model.id]) {
                            continue;
                        }

                        ElectronWindow.webContents.send("reply", {
                            Opcode: "LOADING_STATUS",
                            Data: {
                                Text: `Downloading Model [${model.name}]`,
                                Amount: 75
                            }
                        });
                        
                        if (!existsSync(path.join(__appdir, `storage/model-images/${model.id}`))) {
                            mkdirSync(path.join(__appdir, `storage/model-images/${model.id}`))
                        }

                        for (const image of model.images) {
                            if (existsSync(path.join(__appdir, `storage/model-images/${model.id}/${image.name}`))) {
                                continue;
                            }

                            const packet = await fetch(`http://127.0.0.1:8081/api/models/${model.id}/images/${image.name}`, {
                                method: "GET",
                                headers: {
                                    ["Authorization"]: APIKey
                                }
                            });

                            writeFileSync(path.join(__appdir, `storage/model-images/${model.id}/${image.name}`), Buffer.from(await packet.arrayBuffer()));
                        }

                        models[model.id] = model;
                        IgnoreLists[model.id] = new Set();

                        try {
                            const packet = await fetch(`http://127.0.0.1:8081/api/models/${model.id}`, {
                                method: "GET",
                                headers: {
                                    authorization: APIKey
                                }
                            });

                            if (packet.status !== 200) {
                                break;
                            }

                            const text = await packet.text();

                            const IgnoreList = IgnoreLists[model.id];
                            for (const username of text.split("\n")) {
                                const trimmedUsername = username.trim();
                                if (trimmedUsername.length && !IgnoreList.has(trimmedUsername)) {
                                    IgnoreList.add(trimmedUsername);
                                    //IgnoreList.push(username.trim());
                                }
                            }

                            console.log(`0x1 Setup ignore list for ${model.id}, size: ${IgnoreList.size}`)
                        } catch (er) {
                            console.log(er);
                        }
                    }

                    ElectronWindow.webContents.send("reply", {
                        Opcode: ("LOADING_STATUS"),
                        Data: {
                            Text: ("Authenticating..."),
                            Amount: 100
                        }
                    });

                    console.log(A)
                    for (const [Key, Data] of Object.entries(A)) {
                        try {
                            browserScripts[Key] = Data;
                        } catch (er) {
                            console.log(("Failed to create dynamic function: "), er.toString());
                            browserScripts[Key] = ("() => {}");
                        }
                    }

                    //await win.loadURL(("http://127.0.0.1:8081/dist/"));
//                    await win.loadFile(path.join(__appdir, "src/public/index.html"));
                    //await win.setBounds({ width: 700, height: 600 });
                    send({ Opcode: 2, Data: HWID() });
                    WebsocketConnected = true;
                    console.log(("Websocket Connected"));
                    break;
                }

                case 3: { // DEVICE_CONNECTED
                    console.log(("Device Connected"));
                    const { c, d } = Data;
                    DeviceName = c;
                    DeviceID = d;

                    // Decrypt The Saved Config

                    try {
                        const packet = await fetch(`http://127.0.0.1:8081/api/user/device/${DeviceID}/config`, {
                            method: "GET",
                            headers: {
                                ["Authorization"]: UserAPIKey
                            }
                        });

                        if (packet.status === 200) {
                            const chunks = [];
                            for await (const chunk of packet.body) {
                                chunks.push(chunk);
                            }


                            const encryptedBuffer = Buffer.concat(chunks);
                            const decryptedConfigs = JSONDecode(DataStorage.DecryptBufferToBuffer(encryptedBuffer, UserAPIKey));
                            for (const id of Object.keys(decryptedConfigs)) {
                                if (!configs[id]) {
                                    configs[id] = decryptedConfigs[id];
                                }
                            }
                        }
                    } catch (er) {
                        console.log(er);
                        console.log(("Failed to decode config"));
                    }

                    /*
                    ElectronWindow.webContents.send("reply", {
                        Opcode: "DEVICE",
                        Data: a
                    });
                    */

                    /*
                    for (const id of Object.keys(models)) {
                        try {
                            const packet = await fetch(`http://127.0.0.1:8081/api/models/${id}`, {
                                method: "GET",
                                headers: {
                                    authorization: APIKey
                                }
                            });

                            if (packet.status !== 200) {
                                break;
                            }

                            const text = await packet.text();

                            const IgnoreList = IgnoreLists[id];
                            for (const username of text.split("\n")) {
                                const trimmedUsername = username.trim();
                                if (trimmedUsername.length && !IgnoreList.has(trimmedUsername)) {
                                    IgnoreList.add(trimmedUsername);
                                    //IgnoreList.push(username.trim());
                                }
                            }
                        } catch (er) {
                            console.log(er);
                        }

                        
                        //send({ Opcode: 14, Data: { id } }); // GET_IGNORE_LIST_MODEL
                    }
                        */

                    await win.loadURL(("http://127.0.0.1:8081/dist/"));
//                    await win.loadFile(path.join(__appdir, "src/public/index.html"));
                    await win.setBounds({ width: 700, height: 600 });

                    SyncConfigsToServer(configs, DeviceID, UserAPIKey);
                    SocketFinished();
                    break;
                }

                case 5: {
                    ElectronWindow.webContents.send("reply", {
                        Opcode: "SAVED_DEVICE",
                        Data
                    });
                    const { a, b } = Data;
                    DeviceName = a;
                    DeviceID = b;
                    break;
                }

                case 7: {
                    AIResponsePromises.get(Data.UUID)(Data.Response);
                    AIResponsePromises.delete(Data.UUID);
                    break;
                }

                case 13: { // Setup Ignore List
                    const { id } = Data;

                    const packet = await fetch(`http://127.0.0.1:8081/api/models/${id}`, {
                        method: "GET",
                        headers: {
                            authorization: APIKey
                        }
                    });

                    if (packet.status !== 200) {
                        break;
                    }

                    const text = await packet.text();

                    const IgnoreList = IgnoreLists[id];
                    for (const username of text.split("\n")) {
                        const trimmedUsername = username.trim();
                        if (trimmedUsername.length && !IgnoreList.has(trimmedUsername)) {
                            IgnoreList.add(trimmedUsername);
                                    //IgnoreList.push(username.trim());
                        }
                    }

                    console.log(`Setup ignore list for model ${id}, size: ${IgnoreList.size}`);
                    break;
                }

                case 17: {
                    LastServerPing = Date.now() / 1000;
                    AccountInfo = Data;
                    break;
                }

                case 20: { // Created Model
                    const ModelData = Data;
                    models[ModelData.id] = ModelData;

                    IgnoreLists[ModelData.id] = new Set();

                    ElectronWindow.webContents.send("reply", {
                        Opcode: "CREATED_MODEL",
                        Data: {
                            ID: ModelData.id,
                            Name: ModelData.name
                        }
                    });

                    if (!existsSync(path.join(__appdir, `storage/model-images/${ModelData.id}`))) {
                        mkdirSync(path.join(__appdir, `storage/model-images/${ModelData.id}`))
                    }

                    send({ Opcode: 14, Data: { id: ModelData.id } }); // GET_IGNORE_LIST_MODEL
                    break;
                }

                case 22: {
                    const ModelData = Data;
                    const ExistingModel = models[ModelData.id];

                    for (const image of ModelData.images) {
                        if (existsSync(path.join(__appdir, `storage/model-images/${ModelData.id}/${image.name}`))) {
                            continue;
                        }

                        const packet = await fetch(`http://127.0.0.1:8081/api/models/${ModelData.id}/images/${image.name}`, {
                            method: "GET",
                            headers: {
                                ["Authorization"]: APIKey
                            }
                        });

                        writeFileSync(path.join(__appdir, `storage/model-images/${ModelData.id}/${image.name}`), Buffer.from(await packet.arrayBuffer()));
                    }

                    ExistingModel.images = ModelData.images;
                    ElectronWindow.webContents.send("reply", {
                        Opcode: "MODEL_IMAGE_UPLOAD_COMPLETE",
                        Data
                    });
                    break;
                }

                case 24: {
                    const Model = models[Data.id];
                    Model.model_settings = Data.model_settings;

                    ElectronWindow.webContents.send("reply", ({
                        Opcode: "SAVED_MODEL_SETTINGS",
                        Data: {
                            ID: Data.id
                        }
                    }));
                    break;
                }

                case 26: {
                    const { ID, New, Updated } = Data;
                    const Model = models[ID];
                    Model.images = New;
                    ElectronWindow.webContents.send("reply", ({
                        Opcode: "IMAGE_DESCRIPTION_UPDATED",
                        Data: Updated
                    }));
                    break;
                }

                case 28: {
                    const { ID, New, Updated } = Data;
                    const Model = models[ID];
                    Model.images = New;
                    ElectronWindow.webContents.send("reply", ({
                        Opcode: "IMAGE_DELETED",
                        Data: Updated
                    }));
                    break;
                }

                case 30: {
                    dialog.showMessageBox(ElectronWindow, Data);
                    break;
                }

                case 34: {
                    const { success, message, timezone, ID } = Data;
                    if (success && ID) {
                        console.log("Set model timezone to", timezone);
                        configs[ID].bot_settings.model_timezone = timezone;
                    }

                    ElectronWindow.webContents.send("reply", ({
                        Opcode: "CITY_LOOKUP_RESULT",
                        Data: { message, timezone }
                    }));
                    break;
                }

                case 36: {
                    dialog.showMessageBoxSync(ElectronWindow, {
                        title: `FunnelAI`,
                        type: "warning",
                        message: ("Your subscription has expired.\nUpgrade your subscription on our dashboard (funnelai.bot) to keep using our software"),
                    });
                    app.exit();
                    break;
                }

                case 31: {
                    break;
                }

                case 38: {
                    dialog.showMessageBox(ElectronWindow, {
                        title: "FunnelAI",
                        type: "warning",
                        message: "FunnelAI is currently under down for maintenance.\nWe will alert you when we're back up.\n\nFor in-depth updates check out our telegram channel"
                    });
                    app.exit();
                    break;
                }

                case 40: {
                    LastServerSynced = Date.now();
                    ElectronWindow.webContents.send("reply", {
                        Opcode: "BROWSERS_SYNCED",
                        Data: LastServerSynced
                    });
                    break;
                }

                case 43: {
                    ICPSendToMain({
                        Opcode: "EVALUATED_PROMPT",
                        Data
                    });
                    break;
                }

                case 45: {
                    const { ID, Password } = Data;
                    const Model = models[ID];
                    if (!Model) {
                        break;
                    }

                    Model.password = Password;
                    dialog.showMessageBox(ElectronWindow, {
                        title: "FunnelAI",
                        message: "Successfully set model password",
                        type: "info"
                    });
                    break;
                }

                case 47: {
                    const { a } = Data;
                    if (a) {
                        try {
                            let loaded = 0;
                            const synced = JSON.parse(DataStorage.DecryptRaw(a, UserAPIKey));
                            for (const id of Object.keys(synced)) {
                                if (!configs[id]) {
                                    loaded++
                                    configs[id] = synced[id];
                                }
                            }
                            dialog.showMessageBox({
                                title: "FunnelAI",
                                message: `Loaded ${loaded} browsers from device`,
                                type: "info"
                            });
                            ICPSendToMain({
                                Opcode: "LOADED_FROM_DEVICE",
                                Data: {}
                            });
                        } catch (er) {
                            console.log(er);
                        }
                    }
                    break;
                }

                default:
                    break;
            }
        });

        function OnOpenListener() {
            if (ReconnectionTimeoutID) {
                clearInterval(ReconnectionTimeoutID);
            }

            LastServerPing = Date.now() / 1000;
            PingIntervalID = setInterval(() => {
                send({ Opcode: 11, Data: { a: 1 } });
            }, 5000);

            // Sync Every 5 Minutes
            SyncIntervalID = setInterval(() => {
                SendDeviceFarmingStats(DeviceID, UserAPIKey);
                SyncConfigsToServer(configs, DeviceID, UserAPIKey);
            }, 300000);

            /*
                                // Restart any open browsers for reconnection
            for (const ID of Object.keys(configs)) {
                const shared = shared_memory[ID];
                if (shared && shared.checkBrowserOpen) {
                    const { BrowserOpen, LoggedInTime } = shared.checkBrowserOpen();
                    if (BrowserOpen && LoggedInTime) {
                        await shared.forcefulShutdown();
                        await wait(1000);
                        LaunchBrowser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model]);
                        //await browser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
                    }
                }
            }
            */
           logtail.info(("OnOpenListener Fired"));
        }

        if (socket.readyState == WebSocket.OPEN) {
            OnOpenListener();
            logtail.info(("WebSocket readyState == OPEN"));
        } else {
            socket.addEventListener("open", OnOpenListener);
        }

        /*
        SyncConfigsToServer = function() {
            send({ Opcode: 39, Data: { a: DataStorage.EncryptRawToHex(JSON.stringify(configs), UserAPIKey) } })
        }
            */

        GenerateBrowserConfig = function() {
            let resolve;
            const promise = new Promise((res) => {
                resolve = res;
            });

            const UUID = crypto.randomUUID();
            AIResponsePromises.set(UUID, resolve);
            send({ Opcode: 32, Data: { UUID } });
            return promise;
        }

        //globalThis.WSC = send;
    }

    ConnectWebsocket();

    setInterval(() => {
        if (Date.now() / 1000 - LastServerPing >= 600) {
            logtail.log(("0999999 App Relaunched Date.now() / 1000 - >= 600 "))
            app.relaunch({ args: [] });
            app.exit();
        }
    }, 60000);
}

/*
const socket = {
    send: (data) => {
        ElectronWindow.webContents.send("reply", data);
    }
}
    */

const ICPSendToMain = function(data) {
    if (ElectronWindow) {
        try {
            ElectronWindow.webContents.send("reply", data);
        } catch {
            return;
        }
    }
}

// await browser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);

ipcMain.on("message", async (event, payload) => {
    if (typeof(payload) !== "object" || payload === null) {
        return;
    }

    const { Opcode, Data } = payload;
    if (!Opcode) {
        return;
    }

    switch (Opcode) {
        case "LOGIN_WITH_BROWSER": {
            LoginToken = crypto.randomUUID();
            try {
                await shell.openExternal(("http://127.0.0.1:8081/dashboard/app/callback?token=") + LoginToken + ("&port=") + FASTIFY_PORT.toString());
            } catch (er) {
                await dialog.showMessageBox({
                    title: "FunnelAI",
                    type: "error",
                    message: "Failed to open the URL.\nInstall a web browser; if the issue persists contact support.\n\nThe URL has been copied to your clipboard"
                });
                clipboard.writeText(("http://127.0.0.1:8081/dashboard/app/callback?token=") + LoginToken + ("&port=") + FASTIFY_PORT.toString());
            }
            break;
        }

        case "ACCOUNT_LOGOUT": {
            rmSync(path.join(ROAMING_DIR, "user.bin"));
            app.relaunch({ args: [] });
            app.exit();
            break;
        }

        case "CREATE_ACCOUNT": {
            await shell.openExternal(("http://127.0.0.1:8081/dashboard/register"));
            app.exit();
            break;
        }

        case "MANAGE_ACCOUNT": {
            await shell.openExternal(("https://funnelai.bot/dashboard/app/handoff?token=") + UserAPIKey);
            break;
        }

        case "CONNECT": {
            ICPSendToMain(({
                Opcode: "CONFIGS",
                Data: configs
            }));
            break;
        }
        case "GET_CONFIG": { 
            ICPSendToMain(({
                Opcode: "CONFIG",
                Data: {
                    ID: Data.ID,
                    Config: configs[Data.ID]
                }
            }));
            break;
        }
        case "ENABLE_BOT": {
            console.log(Opcode, Data);
            configs[Data.ID].bot_settings.enabled = Data.Enabled;
            SaveConfig(Data.ID);
            break;
        }
        case "SAVE_MODEL_SETTINGS": {
            SendWebsocket({ Opcode: 23, Data });

            /*
            const { ID, ModelName, ModelAge, CTALink, CTAPlatform } = Data;
            const model = models[ID];

            model.model_settings.name = ModelName;
            model.model_settings.age = parseInt(ModelAge);
            model.model_settings.cta_link = CTALink;
            model.model_settings.cta_platform = CTAPlatform;
            SaveModels();


            */
            break;
        }
        case "GENERATE_USERAGENT": {
            const userAgent = new UserAgent(/^Mozilla\/5\.0 \(Windows NT 10\.0; Win64; x64\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/(100|[1-9]\d{2,})\.\d+\.\d+\.\d+ Safari\/537\.36$/);
            
            ICPSendToMain(({
                Opcode: "GENERATED_USERAGENT",
                Data: {
                    UserAgent: userAgent.toString()
                }
            }));
            break;
        }
        case "CREATE_BROWSER": {
            if (!WebsocketConnected) {
                return;
            }

            const NewConfig = await GenerateBrowserConfig();

            if (Data.VisualName.length > 25) {
                break;
            }

            if (Data.VisualName.match(/[^\w\s\d]+/)) {
                dialog.showMessageBox(ElectronWindow, {
                    title: "FunnelAI",
                    message: "Invalid Visual Name\nNames can only contain letters and numbers (A-Z, a-z, 0-9).",
                    type: "error"
                })
                break;
            }

            Data.VisualName = Data.VisualName.replaceAll(/[\s]+/g, "_");

            // John Feature (VisualName_ID)
            NewConfig.id = `${Data.VisualName.replace(/\s/g, "")}_${NewConfig.id}`;

            NewConfig.name = Data.VisualName;
            NewConfig.user_agent = Data.UserAgent;
            NewConfig.proxy.type = Data.Type;
            NewConfig.cookies = Data.Cookies;
            NewConfig.cookies_id = crypto.randomUUID();

            NewConfig.remarks = Data.Notes ? Data.Notes : "";
            NewConfig.bot_settings["2fa_key"] = Data.TFAKey;
            NewConfig.bot_settings.fill_2fa = Data.Auto2FA;

            if (Data.Type !== "No Proxy") {
                const data = Data.Proxy.trim().split(":");
                NewConfig.proxy.ip = data.shift();
                NewConfig.proxy.port = data.shift();
                NewConfig.proxy.username = data.shift();
                NewConfig.proxy.password = data.shift();

                const packet = await fetch(`https://ipinfo.io/${NewConfig.proxy.ip}/json?token=05335aa7380d7a`);
                const IPData = await packet.json();

                //NewConfig.proxy.locale = glocale(IPData.country); 
                NewConfig.proxy.timezone = IPData.timezone;
            }

            if (Data.Preset && configs[Data.Preset]) {
                const other = configs[Data.Preset];

                NewConfig.bot_settings = JSON.parse(JSON.stringify(other.bot_settings));
                NewConfig.bot_settings.fill_2fa = false;
                NewConfig.bot_settings["2fa_key"] = "";
                NewConfig.bot_settings.selected_model = null;
                NewConfig.bot_settings.model_city = "";
            }

            {
                const ModelKeys = Object.keys(models);
                if (ModelKeys.length === 1) {
                    NewConfig.bot_settings.selected_model = ModelKeys.pop();
                }
            }

            if (Data.Platform) {
                NewConfig.platform = Data.Platform;
            }

            configs[NewConfig.id] = NewConfig;
            //globalThis[NewConfig.id] = NewConfig;
            SaveConfig(NewConfig.id);

            ICPSendToMain(({
                Opcode: "NEW_BROWSER",
                Data: NewConfig
            }));
            break;
        }

        case "RENAME_BROWSER": {
            const { ID, Name } = Data;
            configs[ID].name = Name;
            SaveConfig(ID);

            ICPSendToMain(({
                Opcode: "RENAMED_BROWSER",
                Data
            }))

            break;
        }

        case "SET_WEBCAM": {
            const shared = BrowserCommunication[Data.BrowserID]; 
            if (!shared) {
                break;
            }
            shared.sendMessage({ Opcode: "SET_WEBCAM", Data: `storage/model-images/${Data.ModelID}/${Data.Path}` })
            break;
        }

        case "CREATE_MESSAGE": {
            if (!models[Data.ModelID]) {
                return;
            }

            //await globalThis[`determineStage-${Data.ID}`](Data.messages);

            const config = configs[Data.ID];

            if (!config.bot_settings.model_city || !config.bot_settings.model_timezone) {
                ICPSendToMain(({
                    Opcode: "RECIEVED_MESSAGE",
                    Data: {
                        ID: Data.ID,
                        Message: "You need to set a Model City"
                    }
                }));
                return;
            }

            const AIResponse = await AICreateResponse(Data.messages, {
                username: Data.username,
                model_id: Data.ModelID,
                model_city: config.bot_settings.model_city,
                model_timezone: config.bot_settings.model_timezone,
                match_location: config.bot_settings.match_location || false,
                platform: config.platform || "snapchat",
                model_chat: true
            }, config.bot_settings.match_location);

            if (AIResponse.Image) {
                const AIImageResponse = await AIDetermineImage(models[Data.ModelID].images, Data.messages, Data.RecievedImages);

                ICPSendToMain(({
                    Opcode: "RECIEVED_IMAGE_MESSAGE",
                    Data: {
                        ID: Data.ID,
                        Message: AIResponse.Text,
                        Image: AIImageResponse
                    }
                }));
                break;
            }

            ICPSendToMain(({
                Opcode: "RECIEVED_MESSAGE",
                Data: {
                    ID: Data.ID,
                    Message: AIResponse.Text
                }
            }));
            break;
        }

        case "EVALUATE_PROMPT": {
            if (!models[Data.ModelID]) {
                dialog.showMessageBox({
                    title: "FunnelAI",
                    message: "You need to select a model"
                });
                return;
            }

            const config = configs[Data.ID];

            if (!config.bot_settings.model_timezone) {
                dialog.showMessageBox({
                    title: "FunnelAI",
                    message: "You need to specify a model city"
                });
                return;
            }

            //await globalThis[`determineStage-${Data.ID}`](Data.messages);

            SendWebsocket({
                Opcode: 42,
                Data: {
                    Settings: {
                        model_id: Data.ModelID,
                        model_city: config.bot_settings.model_city,
                        model_timezone: config.bot_settings.model_timezone,
                        match_location: config.bot_settings.match_location || false,
                        platform: config.platform || "snapchat"
                    }
                }
            });
            break;
        }

        case "LAUNCH_BROWSER": {
            if (!WebsocketConnected) {
                return;
            }

            const ID = Data.ID;
            SetBrowserState(ID, true);
            LaunchBrowser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model]);
            //await browser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
            break;
        }

        case "KILL_BROWSER": {
            const ID = Data.ID;
            
            const shared = BrowserCommunication[ID]; 
            if (!shared) {
                break;
            }

            SetBrowserState(ID, false);
            shared.sendMessage({ Opcode, Data });
            //await shared.gracefulShutdown();

            //globalThis.CleanupMemory(ID);

            ICPSendToMain(({
                Opcode: "STATUS_UPDATE",
                Data: {
                    ID,
                    Status: "Killed Browser",
                    LoggedIn: false
                }
            }));
            break;
        }

        case "RESTART_BROWSER": {
            const ID = Data.ID;
            const shared = BrowserCommunication[ID]; 
            if (!shared) {
                break;
            }

            shared.sendMessage({ Opcode, Data });
            await wait(30000);
            //globalThis.CleanupMemory(ConfigID);
            LaunchBrowser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model]);
            //await browser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
            break;
        }

        case "DELETE_BROWSER": {
            const ID = Data.ID;

            const shared = BrowserCommunication[ID]; 
            if (shared) {
                SetBrowserState(ID, false)
                shared.sendMessage({ Opcode, Data });
            }

            delete configs[ID];
            SaveConfigs();

            if (existsSync(path.join(__appdir, `/storage/browser-states/${ID}`))) {
                rmSync(path.join(__appdir, `/storage/browser-states/${ID}`), { recursive: true, force: true, maxRetries: 4 });
            }
            
            ICPSendToMain(({
                Opcode: "DELETED_BROWSER",
                Data: {
                    ID: Data.ID
                }
            }));
            //delete shared_memory[ID];
            SyncConfigsToServer(configs, DeviceID, UserAPIKey);
            SendDeviceFarmingStats(DeviceID, UserAPIKey);

            //globalThis.CleanupMemory(ID);
            break;
        }

        case "DELETE_MODEL": {
            const ID = Data.ID;

            delete models[ID];
            //SaveModels();
            rmSync(path.join(__appdir, `/storage/model-images/${ID}`), { recursive: true, force: true, maxRetries: 4 });
            SendWebsocket({ Opcode: 19, Data: { id: ID } });
            break;
        }

        case "UPDATE_BROWSER_PROXY": {
            const { ID } = Data;
            const config = configs[ID];

            config.proxy.type = Data.Type;

            if (Data.Type !== "No Proxy") {
                const data = Data.Proxy.trim().split(":");
                config.proxy.ip = data.shift();
                config.proxy.port = data.shift();
                config.proxy.username = data.shift();
                config.proxy.password = data.shift();

                const packet = await fetch(`https://ipinfo.io/${config.proxy.ip}/json?token=05335aa7380d7a`);
                const IPData = await packet.json();

                //config.proxy.locale = glocale(IPData.country); 
                config.proxy.timezone = IPData.timezone;
            }

            SaveConfig(ID);
            ICPSendToMain(({
                Opcode: "UPDATED_BROWSER_PROXY",
                Data: {
                    ID,
                    Proxy: config.proxy
                }
            }));

            break;
        }

        case "CHECK_PROXY": {
            const data = Data.Proxy.split(":");
            const IP = data.shift();
            const Port = data.shift();
            const Username = data.shift();
            const Password = data.shift();

            let Result;
            switch (Data.ProxyType) {
                case "HTTP Proxy": {
                    Result = await CheckProxy.CheckHTTP(IP, Port, Username, Password);
                    break;
                }
                case "SOCKS5 Proxy": {
                    Result = await CheckProxy.CheckSOCKS5(IP, Port, Username, Password);
                    break;
                }
            }

            if (!Result) {
                return ICPSendToMain(({
                    Opcode: "INVALID_PROXY",
                    Data: {}
                }));
            }

            ICPSendToMain(({
                Opcode: "VALID_PROXY",
                Data: Result
            }));
            break;
        }

        case "HOME_CHECK_BROWSER_PROXY": {
            const { ID } = Data;
            const ProxyConfig = configs[ID].proxy;

            switch (ProxyConfig.type) {
                case "HTTP Proxy": {
                    Result = await CheckProxy.CheckHTTP(ProxyConfig.ip, ProxyConfig.port, ProxyConfig.username, ProxyConfig.password);
                    break;
                }
                case "SOCKS5 Proxy": {
                    Result = await CheckProxy.CheckSOCKS5(ProxyConfig.ip, ProxyConfig.port, ProxyConfig.username, ProxyConfig.password);
                    break;
                }
            }

            if (!Result) {
                return ICPSendToMain(({
                    Opcode: "HOME_PROXY_CHECK",
                    Data: { 
                        ID,
                        Works: false
                    }
                }));
            }

            ICPSendToMain(({
                Opcode: "HOME_PROXY_CHECK",
                Data: { 
                    ID,
                    Works: true
                }
            }));
            break;
        }

        case "DELETE_IMAGE": {
            SendWebsocket({ Opcode: 27, Data });
            break;
        }

        case "UPDATE_IMAGE_DESCRIPTION": {
            SendWebsocket({ Opcode: 25, Data });
            break;
        }

        case "SAVE_FRIEND_SETTINGS": {
            const { ID, DailyLimit, MaximumPending, AmountToAccept, AcceptEvery } = Data;
            const config = configs[ID];
            config.bot_settings.add_friends_every = AcceptEvery;
            config.bot_settings.add_x_friends = AmountToAccept;
            config.bot_settings.friends_daily_limit = DailyLimit;
            config.bot_settings.maximum_pending_requests = MaximumPending;
            SaveConfig(ID);

            ICPSendToMain(({
                Opcode: "UPDATED_FRIEND_SETTINGS",
                Data: { ID }
            }));
            break;
        }

        case "SAVE_MESSAGING_SETTINGS": {
            const { ID, MessageOpening, KeystrokeDelay, MainSnapPercentage, SexySnapPercentage, SendSnaps, CallResponse, VoiceNoteResponse, followUpDuration, followUpMessage, waitXSecondsReply } = Data;
            const config = configs[ID];
            config.bot_settings.keystroke_delay = KeystrokeDelay;
            config.bot_settings.message_opening = MessageOpening;
            config.bot_settings.main_snap_percentage = MainSnapPercentage;
            config.bot_settings.sexy_snap_percentage = SexySnapPercentage;
            config.bot_settings.send_random_snaps = SendSnaps;
            config.bot_settings.call_response = CallResponse;
            config.bot_settings.voice_note_response = VoiceNoteResponse;
            config.bot_settings.follow_up_duration = followUpDuration;
            config.bot_settings.follow_up_message = followUpMessage;
            config.bot_settings.seconds_before_opening = waitXSecondsReply || 0;
            
            SaveConfig(ID);

            ICPSendToMain(({
                Opcode: "UPDATED_MESSAGING_SETTINGS",
                Data: { ID }
            }));
            break;
        }

        case "SAVE_BROWSER_COOKIES": {
            const { ID, Cookies } = Data;
            const config = configs[ID];

            config.cookies = Cookies;
            config.cookies_id = crypto.randomUUID();
            SaveConfig(ID);

            ICPSendToMain(({
                Opcode: "SAVED_BROWSER_COOKIES",
                Data: { ID }
            }));
            break;
        }

        case "ENABLE_FRIENDS_TASK": {
            const { ID, Value } = Data;
            configs[ID].bot_settings.enable_friend_task = Value;
            SaveConfig(ID);
            break;
        }

        case "UPDATE_BROWSER_2FA": {
            const { ID, Enabled, Key } = Data;
            const config = configs[ID];

            config.bot_settings.fill_2fa = Enabled;
            config.bot_settings["2fa_key"] = Key.trim();
            SaveConfig(ID);

            ICPSendToMain(({
                Opcode: "SAVED_BROWSER_2FA",
                Data: { ID }
            }));
            break;
        }

        case "FRIENDS_ACCEPT_NOW": {
            const { ID } = Data;
            const shared = BrowserCommunication[ID]; 
            if (!shared) {
                break;
            }

            shared.sendMessage({ Opcode, Data });
            break;
        }

        case "CREATE_MODEL": {
            const { Name } = Data;

            if (typeof(Name) !== "string") {
                break;
            }

            if (Name.length > 30) {
                dialog.showMessageBox(ElectronWindow, {
                    title: "FunnelAI",
                    message: "The model name exceeds the limit of 30 characters",
                    type: "error"
                });
                break;
            }
            
            //const NewModel = modelgen();
            //NewModel.name = Name;

            //models[NewModel.id] = NewModel;
            //SaveModels();
            
            /*
            if (!existsSync(path.join(__appdir, `/storage/model-images/${NewModel.id}/`))) {
                mkdirSync(path.join(__appdir, `/storage/model-images/${NewModel.id}/`));
            }
                */

            SendWebsocket({ Opcode: 12, Data: { name: Name } });
            /*
            ICPSendToMain(({
                Opcode: "CREATED_MODEL",
                Data: {
                    ID: NewModel.id,
                    Name
                }
            }));
            */
            break;
        }

        case "GET_MODELS": {
            ICPSendToMain(({
                Opcode: "MODELS",
                Data: models
            }));
            break;
        }

        case "GET_MODEL": {
            ICPSendToMain(({
                Opcode: "MODEL",
                Data: {
                    ID: Data.ID,
                    Config: models[Data.ID]
                }
            }));
            break;
        }

        case "BROWSER_SELECT_MODEL": {
            const { ID, Model } = Data;
            configs[ID].bot_settings.selected_model = Model;
            SaveConfig(ID);

            ICPSendToMain(({
                Opcode: "SELECTED_MODEL",
                Data: {
                    Config: models[Model]
                }
            }));
            break;
        }

        case "MODEL_CITY_UPDATE": {
            const { ID, City } = Data;
            configs[ID].bot_settings.model_city = City;
            SaveConfig(ID);
            break;
        }

        case "EXPORT_BROWSER": {
            const { ID } = Data;

            const SaveTo = dialog.showSaveDialogSync(ElectronWindow, {
                title: "Save Export",
                defaultPath: `${configs[ID].name}_export.funnel`,
                filters: [
                    { name: "Funnel", extensions: ["funnel"] }
                ]
            });

            if (!SaveTo) {
                break;
            }

            /*

            const zip = archiver("zip");
            const stream = createWriteStream(SaveTo);

            stream.on("open", () => {
                dialog.showMessageBoxSync(ElectronWindow, {
                    message: "Exporting browser data, please wait...",
                    buttons: [],
                    title: "Export in Progress",
                    type: "info"
                });
            });

            stream.on("close", () => {
                dialog.showMessageBoxSync(ElectronWindow, {
                    message: "The browser has been exported",
                    buttons: [],
                    title: "Export Complete",
                    type: "info"
                });
            });

            zip.on("error", (error) => {
                dialog.showMessageBoxSync(ElectronWindow, {
                    message: "Browser export failed. Please check the console for more details",
                    buttons: [],
                    title: "Failed to Export",
                    type: "error"
                });
                console.log(error);
            })

            zip.pipe(stream);
            zip.directory(path.join(__appdir, `/storage/browser-states/${ID}`), "browser-state");
            zip.append(JSON.stringify(config, null, 4), { name: "config.json" });

            await zip.finalize();
            */
            
            const config = configs[ID];
            config.cookies_id = crypto.randomUUID();

            DataStorage.WriteFile(SaveTo, JSON.stringify(config), ("3e5a180c-f126-4b61-9d3d-2ea8bac4507f")) // 3e5a180c-f126-4b61-9d3d-2ea8bac4507f export key


            break;
        }

        case "EXPORT_ALL_BROWSERS": {
            const { Platform } = Data;
            const SaveTo = dialog.showOpenDialogSync(ElectronWindow, {
                title: "Select a Folder to Save Exports",
                properties: ["openDirectory"]
            });

            if (!SaveTo) {
                break;
            }

            const FolderPath = SaveTo.shift();

            for (const config of Object.values(configs)) {
                if ((config.platform || "snapchat") !== Platform) {
                    continue;
                }
                DataStorage.WriteFile(path.join(FolderPath, `${config.name}_export.funnel`), JSON.stringify(config), ("3e5a180c-f126-4b61-9d3d-2ea8bac4507f")) // 3e5a180c-f126-4b61-9d3d-2ea8bac4507f export key
            }
            break;
        }

        /*
        c "EXPORT_MODEL": {
            const { ID } = Data;
            const Model = models[ID];
            
            const SaveTo = dialog.showSaveDialogSync(ElectronWindow, {
                title: "Save Model Export",
                defaultPath: `${Model.name}_export.zip`,
                filters: [
                    { name: "ZIP", extensions: ["zip"] }
                ]
            });

            if (!SaveTo) {
                break;
            }

            const zip = archiver("zip");
            const stream = createWriteStream(SaveTo);

            stream.on("open", () => {
                dialog.showMessageBoxSync(ElectronWindow, {
                    message: "Exporting Model, please wait...",
                    buttons: [],
                    title: "Export in Progress",
                    type: "info"
                });
            });

            stream.on("close", () => {
                dialog.showMessageBoxSync(ElectronWindow, {
                    message: "The model has been exported",
                    buttons: [],
                    title: "Export Complete",
                    type: "info"
                });
            });

            zip.on("error", (error) => {
                dialog.showMessageBoxSync(ElectronWindow, {
                    message: "Model export failed. Please check the console for more details",
                    buttons: [],
                    title: "Failed to Export",
                    type: "error"
                });
                console.log(error);
            })

            zip.pipe(stream);

            zip.directory(path.join(__appdir, `/storage/bot-images/${ID}`), "images");
            zip.append(JSON.stringify(Model, null, 4), { name: "model.json" });

            await zip.finalize();
            break;
        }
        */

        case "EXPORT_FRIENDS": {
            const { ID } = Data;
            const Platform = configs[ID].platform || "snapchat";
            const SavePath = dialog.showSaveDialogSync(ElectronWindow, {
                title: `Save ${Platform == "snapchat" ? "Friends": "Followers"}`,
                defaultPath: `${configs[ID].name}_${Platform == "snapchat" ? "friend": "follower"}_list.txt`,
                filters: [
                    { name: "TXT", extensions: ["txt"] }
                ]
            });

            if (!SavePath) {
                break;
            }

            const shared = BrowserCommunication[ID]; 
            if (!shared) {
                return dialog.showMessageBox(ElectronWindow, {
                    message: Platform == "snapchat" ? "You must be logged into Snapchat to export your friends list" : "You must be logged into Instagram to export your followers",
                    buttons: [],
                    title: "Failed to Export",
                    type: "error"
                });
            }

            const FriendData = await shared.sendMessageAsync({ Opcode: "GET_FRIENDS", Data: {} });
            const parsed = [];

            if (!FriendData) {
                return;
            }

            const { friends, me } = FriendData;

            for (const { username, mutableUsername, id } of friends) {
                const ActualUsername = username || mutableUsername;
                if (id === me.id || ActualUsername === me.username) {
                    continue;
                }
                if (ActualUsername === "myai" || ActualUsername === "teamsnapchat") {
                    continue;
                }
                parsed.push(ActualUsername);
            }
            
            writeFileSync(SavePath, parsed.join("\n"));
            dialog.showMessageBox(ElectronWindow, {
                message: `${parsed.length} ${Platform == "snapchat" ? "friends" : "followers"} have been exported`,
                buttons: [],
                title: "Export Complete",
                type: "info"
            });

            break;
        }

        case "EXPORT_BROWSER_COOKIES": {
            const { ID } = Data;
            const SavePath = dialog.showSaveDialogSync(ElectronWindow, {
                title: "Save Cookies",
                defaultPath: `${configs[ID].name}_cookies.txt`,
                filters: [
                    { name: "TXT", extensions: ["txt"] }
                ]
            });

            if (!SavePath) {
                break;
            }

            const shared = BrowserCommunication[ID]; 
            if (!shared) {
                break;
            }

            const Result = await shared.sendMessageAsync({ Opcode, Data });
            if (!Result || !Array.isArray(Result)) {
                break;
            }

            writeFileSync(SavePath, JSON.stringify(Result));

            dialog.showMessageBoxSync(ElectronWindow, {
                message: `${Result.length} cookies have been exported`,
                buttons: [],
                title: "Export Complete",
                type: "info"
            });

            break;
        }

        case "IMPORT_BROWSER": {  
            const Locations = dialog.showOpenDialogSync(ElectronWindow, {
                title: "Import Browser",
                filters: [
                    { name: "Funnel", extensions: ["funnel"] }
                ],
                properties: ["multiSelections"]
            });

            if (!Locations) {
                break;
            }

            let Successful = 0;
            let Failed = 0;
            for (const ZipLocation of Locations) {
                let ImportedJSON;
                try {
                    ImportedJSON = JSON.parse(DataStorage.ReadFile(ZipLocation, ("3e5a180c-f126-4b61-9d3d-2ea8bac4507f")));
                } catch (er) {
                    Failed++;
                    continue;
                }
    
                if (existsSync(path.join(__appdir, `/storage/browser-states/${ImportedJSON.id}`)) || configs[ImportedJSON.id]) {
                    Failed++;
                    continue;
                }
    
                ImportedJSON.cookies_id = crypto.randomUUID();     

                configs[ImportedJSON.id] = ImportedJSON;

                SaveConfigs();
                Successful++;
            }

            dialog.showMessageBoxSync(ElectronWindow, {
                message: `${Successful} Browsers have successfully been imported${Failed > 0 ? `\n${Failed} Browsers failed to import` : ""}`,
                buttons: [],
                title: "Imported",
                type: "info"
            });

            ICPSendToMain(({
                Opcode: "SUCCESSFUL_BROWSER_IMPORT",
                Data: {}
            }));

            break;
        }

        /*
        c "IMPORT_MODEL": {
            const Locations = dialog.showOpenDialogSync(ElectronWindow, {
                title: "Import Model",
                filters: [
                    { name: "ZIP", extensions: ["zip"] }
                ],
                properties: ["multiSelections"]
            });

            if (!Locations) {
                break;
            }

            let Successful = 0;
            let Failed = 0;
            for (const ZipLocation of Locations) {
                const zip = new StreamZip.async({ file: ZipLocation });
                await zip.extract("model.json", path.join(__appdir, "/storage/temp.json"));
    
                let ImportedJSON;
                try {
                    ImportedJSON = JSON.parse(readFileSync(path.join(__appdir, "/storage/temp.json"), "utf-8"));
                } catch (er) {
                    Failed++
                    continue;
                }
    
                if (existsSync(path.join(__appdir, `/storage/bot-images/${ImportedJSON.id}`)) || models[ImportedJSON.id]) {
                    Failed++
                    continue;
                }
    
                mkdirSync(path.join(__appdir, `/storage/bot-images/${ImportedJSON.id}`));
                await zip.extract("images", path.join(__appdir, `/storage/bot-images/${ImportedJSON.id}`));
                
                models[ImportedJSON.id] = ImportedJSON;
                SaveModels();
                SendWebsocket({ Opcode: 12, Data: { id: ImportedJSON.id, name: ImportedJSON.name } });
    
                rmSync(path.join(__appdir, "/storage/temp.json"));
                await zip.close();
                Successful++;
            }

            dialog.showMessageBoxSync(ElectronWindow, {
                message: `${Successful} Models have successfully been imported${Failed > 0 ? `\n${Failed} Models failed to import` : ""}`,
                buttons: [],
                title: "Imported",
                type: "info"
            });

            ICPSendToMain(({
                Opcode: "SUCCESSFUL_MODEL_IMPORT",
                Data: {}
            }));

            break;
        }
        */

        case "UPLOAD_MULTIPLE_MODEL_IMAGES": {
            const { ID, Purpose, OutfitDay } = Data;
            const Images = dialog.showOpenDialogSync(ElectronWindow, {
                title: "Select Images",
                filters: [
                    { name: "jpg", extensions: ["jpg", "jpeg", "png"] }
                ],
                properties: ["multiSelections"]
            });

            if (!Images) {
                break;
            }

            const model = models[ID];

            let uploadcount = 0;
            for (const filePath of Images) {
                const basename = path.basename(filePath);
                if (model.images.find(x => x.name === basename)) {
                    /*
                                        dialog.showMessageBoxSync(ElectronWindow, {
                        title: "Failed to upload image",
                        message: `${basename} already exists`,
                        type: "error"
                    });
                    */
                    continue;
                }

                const packet = await fetch(`http://127.0.0.1:8081/api/models/${ID}/upload`, {
                    method: "POST",
                    headers: {
                        ["Content-Type"]: "application/json",
                        ["Authorization"]: UserAPIKey
                    },
                    body: JSON.stringify({
                        Purpose,
                        Day: OutfitDay,
                        Description: "",
                        ModelID: ID,
                        ImageData: readFileSync(filePath, "base64url")
                    })
                });

                if (packet.status === 400) {
                    const { error } = await packet.json();
                    dialog.showMessageBoxSync(ElectronWindow, {
                        title: "Failed to upload image",
                        message: `${basename} failed to upload\n\n${error}`
                    });
                    continue;
                }

                if (packet.status !== 200) {
                    continue;
                }
            }

            SendWebsocket({ Opcode: 21, Data });

            /*
            dialog.showMessageBoxSync(ElectronWindow, {
                title: "Uploaded images",
                message: `Successfully uploaded ${uploadcount} images`,
                type: "info"
            });

            ICPSendToMain(({
                Opcode: "SUCCESSFUL_MULTIPLE_UPLOAD",
                Data: {}
            }));
            */
            break;
        }

        case "FETCH_STATISTICS": {
            const { ID } = Data;

            ICPSendToMain(({
                Opcode: "FETCHED_STATISTICS",
                Data: {
                    ID,
                    Data: configs[ID].analytics
                }
            }))
            break;
        }

        case "BLUR_MEDIA": {
            const { ID, Enabled } = Data;
            configs[ID].bot_settings.blur_media = Enabled;
            SaveConfig(ID);
            
            const shared = BrowserCommunication[ID]; 
            if (!shared) {
                break;
            }

            if (shared.sendMessage) {
                shared.sendMessage({ Opcode, Data });
            }
            break;
        }

        case "PHASE_ICONS": {
            const { ID, Enabled } = Data;
            configs[ID].bot_settings.phase_icons = Enabled;
            SaveConfig(ID);

            const shared = BrowserCommunication[ID]; 
            if (!shared) {
                break;
            }

            if (shared.sendMessage) {
                shared.sendMessage({ Opcode, Data });
            }
            break;
        }

        case "CHOOSE_CHROME_EXTENSION": {
            const FolderPath = dialog.showOpenDialogSync(ElectronWindow, {
                title: "Choose Extension",
                properties: ["openDirectory"]
            });

            if (!FolderPath) {
                break;
            }

            let AbsolutePath = FolderPath.shift();

            if (!existsSync(path.join(AbsolutePath, "/manifest.json"))) {
                dialog.showMessageBoxSync(ElectronWindow, {
                    message: "Invalid Extension",
                    buttons: [],
                    title: "Please select a valid chrome extension",
                    type: "error"
                });
                break;
            }

            let Manifest;
            try {
                Manifest = JSON.parse(readFileSync(path.join(AbsolutePath, "/manifest.json"), "utf-8"));
            } catch {
                dialog.showMessageBoxSync(ElectronWindow, {
                    message: "Invalid Extension",
                    buttons: [],
                    title: "Please select a valid chrome extension",
                    type: "error"
                });
                break;
            }

            appconfig.global_extensions.push({
                name: Manifest.name,
                version: Manifest.version,
                path: AbsolutePath
            });

            SaveAppConfig();
            ICPSendToMain(({
                Opcode: "APP_CONFIG",
                Data: appconfig
            }));
            break;
        }

        case "REMOVE_BROWSER_EXTENSION": {
            const { path } = Data;
            appconfig.global_extensions = appconfig.global_extensions.filter(x => x.path !== path);
            SaveAppConfig();

            ICPSendToMain(({
                Opcode: "APP_CONFIG",
                Data: appconfig
            }));
            break;
        }

        case "TOGGLE_DEVELOPER_MODE": {
            const { Enabled } = Data;
            appconfig.developer_mode.enabled = Enabled;
            SaveAppConfig();

            break;
        }

        case "TOGGLE_PERSISTENT_TABS": {
            const { Enabled } = Data;
            appconfig.persistent_tabs_enabled = Enabled;
            SaveAppConfig();

            break;
        }

        case "RESTART_BROWSERS_EVERY": {
            const { Duration, Platform } = Data;

            switch (Platform) {
                case "snapchat":
                    appconfig.reset_browsers_every = Duration;
                    break;
                case "instagram":
                    appconfig.reset_browsers_every_instagram = Duration;
                    break;
                default:
                    break;
            }

            SaveAppConfig();                
            break;
        }

        case "ACTUAL_RESTART_BROWSERS_EVERY": {
            const { Duration } = Data;

            appconfig.actual_restart_browsers_every = Duration;
            SaveAppConfig();
            break;
        }

        case "GET_APP_CONFIG": {
            ICPSendToMain(({
                Opcode: "APP_CONFIG",
                Data: appconfig
            }));
            break;
        }

        case "CHECK_LATEST_VERSION": {
            try {
                const packet = await fetch(("http://127.0.0.1:8081/api/app/version"), {
                    method: "GET",
                    headers: {
                        ["Authorization"]: UserAPIKey
                    }
                });

                const { tag_name, body } = await packet.json();
                ICPSendToMain(({
                    Opcode: "LATEST_VERSION",
                    Data: {
                        tag_name,
                        body,
                        current: CURRENT_VERSION
                    }
                }));
            } catch (er) {
                console.log(er);
            }
            break;
        }

        /*
        c "DOWNLOAD_UPDATE": {
            const SavePath = dialog.showSaveDialogSync(ElectronWindow, {
                title: "Choose a location to save the update",
                defaultPath: 'latest-src.rar',
                filters: [
                    { name: "RAR", extensions: ["rar"] }
                ]
            });

            if (!SavePath) {
                break;
            }

            const packet = await fetch(("http://127.0.0.1:8081/api/app/download"), {
                method: "GET",
                headers: {
                    ["Authorization"]: UserAPIKey
                }
            });

            writeFileSync(SavePath, Buffer.from(await packet.arrayBuffer()));
            dialog.showMessageBoxSync(ElectronWindow, {
                message: "The update has been downloaded.\nReplace the current source files.",
                buttons: [],
                title: "Download Successful",
                type: "info"
            });
            break;
        }
        */

        case "DOWNLOAD_UPDATE_INSTALL": {
            await ElectronWindow.loadURL(("http://127.0.0.1:8081/dist/loading"));

            const packet = await fetch(("http://127.0.0.1:8081/api/app/download"), {
                method: "GET",
                headers: {
                    ["Authorization"]: UserAPIKey
                }
            });

            const totalBytes = Number(packet.headers.get("content-length")) || 0;
            const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
            const reader = packet.body.getReader();
            let downloadedBytes = 0;
            let lastUpdate = 0;

            const fileStream = createWriteStream(path.join(__appdir, "/storage/temp.zip"));
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                fileStream.write(Buffer.from(value));
                downloadedBytes += value.length;

                const now = Date.now();
                if (now - lastUpdate > 350) {
                    lastUpdate = now;
                    const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(1);
                    ElectronWindow.webContents.send("reply", {
                        Opcode: "LOADING_STATUS",
                        Data: {
                            Text: `Downloading Update [${downloadedMB}MB / ${totalMB}MB]`,
                            Amount: 50
                        }
                    });
                }
            }
            
            await new Promise((resolve) => {
                fileStream.end(() => fileStream.close((err) => {
                    if (err) {
                        console.log(err);
                        resolve();
                    }
                    resolve();
                }));
            });

            console.log("Finished");

            let AmountOpen = Object.values(BrowserOpenStatus).filter(x => x.BrowserOpen).length;
            let ClosedProgress = 0;

            const BackupBrowserStates = JSON.parse(JSON.stringify(BrowserStates)); // save before shutting down

            for (const [ID, OpenData] of Object.entries(BrowserOpenStatus)) {
                const CommunicationTunnel = BrowserCommunication[ID];
                if (CommunicationTunnel && OpenData?.BrowserOpen) {
                    ClosedProgress++;
                    ICPSendToMain({
                        Opcode: "LOADING_STATUS",
                        Data: {
                            Text: `Shutting Down Browsers [${ClosedProgress} / ${AmountOpen}]`,
                            Amount: 55
                        }
                    });

                    CommunicationTunnel.sendMessage({ Opcode: "KILL_BROWSER", Data: {} });
                    await wait(3500);
                }
            }

            writeFileSync(path.join(__appdir, "storage/state.json"), JSON.stringify(BackupBrowserStates)); // restore

            if (DeveloperFlagNoDownload) {
                console.log("cancelled");
                break;
            }

            const zip = new StreamZip.async({ file: path.join(__appdir, "/storage/temp.zip") });

            ICPSendToMain({
                Opcode: "LOADING_STATUS",
                Data: {
                    Text: "Unpacking Update...",
                    Amount: 60
                }
            });
            
            await zip.extract("FunnelAI.exe", path.join(__appdir, "/storage/FunnelAI.tmp"));
            await zip.extract("app.asar", path.join(__appdir, "/storage/app.tmp"));
            await zip.close();

            rmSync(path.join(__appdir, "/storage/temp.zip"), { force: true });

            ICPSendToMain({
                Opcode: "LOADING_STATUS",
                Data: {
                    Text: "Relaunching...",
                    Amount: 100
                }
            });
            break;
        }

        case "UPDATE_BROWSER_NO_DELAY": {
            const { ID, Enabled } = Data;
            const config = configs[ID];
            config.bot_settings.no_delays = Enabled;
            SaveConfigs();
            break;
        }

        case "UPDATE_BROWSER_REMARKS": {
            const { ID, Name } = Data;
            const config = configs[ID];
            config.remarks = Name || "";
            SaveConfigs();

            ICPSendToMain(({
                Opcode: "UPDATED_BROWSER_REMARKS",
                Data
            }));
            break;
        }

        case "HOME_CHECK_ALL_BROWSERS_PROXY": {
            const checks = [];

            for (const { proxy, id } of Object.values(configs)) {
                checks.push(new Promise(async (resolve) => {
                    let Result;

                    switch (proxy.type) {
                        case "HTTP Proxy": {
                            Result = await CheckProxy.CheckHTTP(proxy.ip, proxy.port, proxy.username, proxy.password);
                            break;
                        }
                        case "SOCKS5 Proxy": {
                            Result = await CheckProxy.CheckSOCKS5(proxy.ip, proxy.port, proxy.username, proxy.password);
                            break;
                        }
                        default:
                            return resolve();
                    }
    
                    if (!Result) {
                        ICPSendToMain(({
                            Opcode: "HOME_PROXY_CHECK",
                            Data: { 
                                ID: id,
                                Works: false
                            }
                        }));
                        return resolve();
                    }
    
                    ICPSendToMain(({
                        Opcode: "HOME_PROXY_CHECK",
                        Data: { 
                            ID: id,
                            Works: true
                        }
                    }));
                    resolve();
                }));
            }

            await Promise.all(checks);
            break;
        }

        case "ADD_BROWSER_TO_PRESETS": {
            const { ID, Value } = Data;
            const config = configs[ID];
            config.include_in_presets = Value;
            SaveConfig(ID);
            break;
        }

        case "LAUNCH_ALL_BROWSERS": {
            const { Platform } = Data;
            
            for (const config of Object.values(configs)) {
                if ((config.platform || "snapchat") !== Platform) {
                    continue;
                }

                const shared = BrowserCommunication[config.id];
                const OpenData = BrowserOpenStatus[config.id]; 
                if (shared && OpenData) {
                    if (OpenData && OpenData?.BrowserOpen) {
                        continue;
                    }
                }
                SetBrowserState(config.id, true);
                LaunchBrowser(config, models[config.bot_settings.selected_model], IgnoreLists[config.bot_settings.selected_model], true);
                //await browser(config, models[config.bot_settings.selected_model], IgnoreLists[config.bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
                await wait(5000);
            } 
            break;
        }

        case "LAUNCH_ALL_BROWSER_WITH_PROXY": {
            const { Platform } = Data;

            for (const config of Object.values(configs)) {
                if ((config.platform || "snapchat") !== Platform) {
                    continue;
                }
                
                const shared = BrowserCommunication[config.id];
                const OpenData = BrowserOpenStatus[config.id]; 
                if (shared && OpenData) {
                    if (OpenData && OpenData?.BrowserOpen) {
                        continue;
                    }
                }

                if (config.proxy.type === "HTTP Proxy" || config.proxy.type === "SOCKS5 Proxy") {
                    SetBrowserState(config.id, true);
                    LaunchBrowser(config, models[config.bot_settings.selected_model], IgnoreLists[config.bot_settings.selected_model], true);
                    //await browser(config, models[config.bot_settings.selected_model], IgnoreLists[config.bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
                    await wait(5000);
                }
            }
            break;
        }

        case "SHUTDOWN_ALL_BROWSERS": {
            const { Platform } = Data;

            for (const config of Object.values(configs)) {
                if ((config.platform || "snapchat") !== Platform) {
                    continue;
                }
                
                const shared = BrowserCommunication[config.id];
                const OpenData = BrowserOpenStatus[config.id]; 
                if (shared && OpenData) {
                    if (OpenData && OpenData?.BrowserOpen) {
                        SetBrowserState(config.id, false);
                        shared.sendMessage({ Opcode: "KILL_BROWSER", Data: {} })
                    }
                }
            }
            break;
        }

        case "RESTART_ALL_BROWSERS": {
            const { Platform } = Data;
            for (const config of Object.values(configs)) {
                if ((config.platform || "snapchat") !== Platform) {
                    continue;
                }
                
                const shared = BrowserCommunication[config.id];
                const OpenData = BrowserOpenStatus[config.id]; 
                if (shared && OpenData) {
                    if (OpenData && OpenData?.BrowserOpen) {
                        shared.sendMessage({ Opcode: "KILL_BROWSER", Data: {} })
                        await wait(5000);
                        LaunchBrowser(config, models[config.bot_settings.selected_model], IgnoreLists[config.bot_settings.selected_model]);
                        //await browser(config, models[config.bot_settings.selected_model], IgnoreLists[config.bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
                    }
                }
            }
            break;
        }

        case "SET_APP_TOP_MOST": {
            const { Enabled } = Data;
            ElectronWindow.setAlwaysOnTop(Enabled);
            appconfig.top_most = Enabled;
            SaveAppConfig();
            break;
        }

        case "GET_APP_VERSION": {
            ICPSendToMain({
                Opcode: "APP_VERSION",
                Data: {
                    Version: CURRENT_VERSION
                }
            });
            break;
        }

        case "UPDATE_GLOBAL_BROWSER_THEME": {
            const { Type } = Data;
            appconfig.global_browser_theme = Type;
            SaveAppConfig();
            break;
        }

        case "MASS_MESSAGE_TEXT_UPDATE": {
            const { ID, Message } = Data;
            const config = configs[ID];
            config.bot_settings.mass_message_message = Message;
            SaveConfig(ID);
            break;
        }

        case "MASS_MESSAGE_ENABLE": {
            const { ID, Enabled } = Data;
            const config = configs[ID];
            config.bot_settings.enable_mass_message = Enabled;
            SaveConfig(ID);
            break;
        }

        case "SAVE_DEVICE_NAME": {
            if (typeof(Data) !== "string") {
                break;
            }

            if (Data.length > 30) {
                dialog.showMessageBox(ElectronWindow, {
                    title: "FunnelAI",
                    message: "Device names must be under 30 characters",
                    type: "error"
                });
                break;
            }

            SendWebsocket({ Opcode: 4, Data });
            break;
        }

        case "AUTOMATICALLY_OPEN_URLS": {
            const { Value } = Data;
            appconfig.automatically_open_urls = Value.split("|");
            SaveAppConfig();
            break;
        }

        case "UPLOADED_IMAGE": {
            SendWebsocket({ Opcode: 21, Data });
            break;
        }
        
        case "SET_CUSTOM_API_KEY": {
            SendWebsocket({ Opcode: 29, Data });
            break;
        }

        case "DEVELOPER_DONT_USE_IGNORE_LIST": {
            const { Enabled } = Data;
            appconfig.developer_mode.no_ignore_list = Enabled;
            SaveAppConfig();
            break;
        }

        case "DEVELOPER_DONT_USE_SUBSCRIBED_LIST": {
            const { Enabled } = Data;
            appconfig.developer_mode.no_subscribed_list = Enabled;
            SaveAppConfig();
            break;
        }

        case "DEVELOPER_IGNORE_NON_DEVELOPER": {
            const { Enabled } = Data;
            appconfig.developer_mode.ignore_developer_username = Enabled;
            SaveAppConfig();
            break;
        }

        case "DEVELOPER_INFINITE_CHAT": {
            const { Enabled } = Data;
            appconfig.developer_mode.infinite_chat = Enabled;
            SaveAppConfig();
            break;
        }

        case "FRIENDS_IGNORE_PENDING_IGNORED": {
            const { ID, Value } = Data;
            configs[ID].bot_settings.friends_ignore_pending_ignored = Value;
            SaveConfig(ID);
            break;
        }

        case "IMPORT_FROM_ADSPOWER": {
            const Location = dialog.showOpenDialogSync(ElectronWindow, {
                title: "Import Browser",
                filters: [
                    { name: "xlsx", extensions: ["xlsx"] }
                ]
            });

            if (!Location) {
                return;
            }

            const { Platform } = Data;
            let AdspowerData;
            try {
                AdspowerData = adsPowerDeserialize(Location.pop());
            } catch (er) {
                console.log(er);
            }

            for (const profile of AdspowerData) {
                const NewConfig = await GenerateBrowserConfig();
                NewConfig.name = profile.Name;
                NewConfig.user_agent = profile.UserAgent;
                NewConfig.remarks = profile.Note;

                if (profile.Proxy) {
                    let IPData = profile.Proxy.trim().split(":");
                    NewConfig.proxy.ip = IPData.shift();
                    NewConfig.proxy.port = IPData.shift();
                    NewConfig.proxy.username = IPData.shift();
                    NewConfig.proxy.password = IPData.shift();
                    NewConfig.proxy.type = profile.ProxyType === "socks5" ? "SOCKS5 Proxy" : "HTTP Proxy";
                }

                if (profile.Cookie) {
                    try {
                        NewConfig.cookies = JSON.parse(profile.Cookie);
                    } catch (er) {
                        console.log(er);
                    }
                }

                {
                    const ModelKeys = Object.keys(models);
                    if (ModelKeys.length === 1) {
                        NewConfig.bot_settings.selected_model = ModelKeys.pop();
                    }
                }

                NewConfig.platform = Platform;
                configs[NewConfig.id] = NewConfig;
            }

            SaveConfigs();
            ICPSendToMain(({
                Opcode: "SUCCESSFUL_BROWSER_IMPORT",
                Data: {}
            }));
            break;
        }

        case "CHECK_CITY_TIME": {
            try {
                const { Value, ID } = Data;

                const packet = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(Value)}&format=json&addressdetails=1`, {
                    method: "GET",
                    headers: {
                        ["User-Agent"]: AccountInfo.id
                    }
                });
                const cities = await packet.json();
                if (!cities.length) {
                    break;
                }

                const { lat, lon } = cities.shift();
                SendWebsocket({ Opcode: 33, Data: { lat, lon, ID } });
            } catch {
                break;
            }
            break;
        }

        case "RENAME_MODEL_VISUAL_NAME": {
            SendWebsocket({ Opcode: 35, Data });
            break;
        }

        case "TRIGGER_EVENT": {
            const EventName = Data;

            switch (EventName) {
                case "RELAUNCH": {
                    app.relaunch({ args: [] });
                    app.exit();
                    break;
                }
                case "CRASH": {
                    process.crash();
                    break;
                }
                case "UPDATE": {
                    CURRENT_VERSION = ("v1.0.0");
                    break;
                }
                case "UPDATE_NO_DOWNLOAD": {
                    CURRENT_VERSION = ("v1.0.0");
                    DeveloperFlagNoDownload = true;
                    break;
                }
                case "DUMP_CONFIGS": {
                    writeFileSync(path.resolve(__appdir, "dump.json"), JSON.stringify(configs, null, 4));
                    break;
                }
                case "RICH_BOY": {
                    for (let i=1; i < 50; i++) {
                        dialog.showMessageBox(ElectronWindow, {
                            title: "Rich Boy",
                            message: "Rich Boy",
                            buttons: ["Rich Boy", "Rich Boy"],
                        })
                        await wait(150);
                    }
                    break;
                }
            }

            break;
        }

        case "SYNC_BROWSERS": {
            SyncConfigsToServer(configs, DeviceID, UserAPIKey);
            SendDeviceFarmingStats(DeviceID, UserAPIKey);
            break;
        }

        case "ENABLE_MESSAGING": {
            const { Enabled, ID } = Data;
            configs[ID].bot_settings.messaging_enabled = Enabled;
            break;
        }

        case "BACKGROUND_MODE": {
            const { Enabled, ID } = Data;
            configs[ID].bot_settings.background_mode = Enabled;
            break;
        }

        case "ENABLE_MATCH_LOCATION": {
            const { Enabled, ID } = Data;
            configs[ID].bot_settings.match_location = Enabled;
            break;
        }

        case "INSTAGRAM_AUTO_FOLLOWER": {
            if (!AccountInfo.InstagramFollowerFeature) {
                break;
            }

            const { Usernames, ID, IntervalLeft, IntervalRight } = Data;
            const shared = BrowserCommunication[ID];
            if (shared) {
                shared.sendMessage({ Opcode, Data });
                //await shared.StartAutoFollower(Usernames, IntervalLeft, IntervalRight);
            }
            break;
        }

        case "GRAB_ACCOUNT_FORM_DATA": {
            const { ID } = Data;
            const shared = BrowserCommunication[ID];
            if (shared) {
                const Result = await shared.sendMessageAsync({ Opcode, Data });
                if (!Result) {
                    break;
                }
                ICPSendToMain({
                    Opcode: "ACCOUNT_UPDATE_FORM_DATA",
                    Data: Result
                });
            }
            break;
        }

        case "UPDATE_ACCOUNT_DATA": {
            const { ID, FormData } = Data;
            const shared = BrowserCommunication[ID];
            if (shared) {
                shared.sendMessage({ Opcode, Data });
            }
            break;
        }

        case "UPLOAD_STORY": {
            const { ID, Path, ModelID } = Data;
            const shared = BrowserCommunication[ID];
            if (shared) {
                shared.sendMessage({ Opcode: "UPLOAD_STORY", Data: `storage/model-images/${ModelID}/${Path}` })
            }
            break;
        }

        case "UPDATE_ACCOUNT_NOTE": {
            const { ID, Text } = Data;
            const shared = BrowserCommunication[ID];
            if (shared) {
                shared.sendMessage({ Opcode, Data });
                //const D = await shared.instagramSetNote(Text);
                //console.log(D);
            }
            break;
        }

        case "LOCK_MODEL_WITH_PASSWORD": {
            SendWebsocket({ Opcode: 44, Data });
            break;
        }

        case "LOAD_FROM_DEVICE": {
            try {
                const { ID } = Data;

                const packet = await fetch(`http://127.0.0.1:8081/api/user/device/${ID}/config`, {
                    method: "GET",
                    headers: {
                        ["Authorization"]: UserAPIKey
                    }
                });

                if (packet.status === 200) {
                    const chunks = [];
                    for await (const chunk of packet.body) {
                        chunks.push(chunk);
                    }

                    let loaded = 0;
                    const encryptedBuffer = Buffer.concat(chunks);
                    const decryptedConfigs = JSON.parse(DataStorage.DecryptRawFromBuffer(encryptedBuffer, UserAPIKey));
                    for (const id of Object.keys(decryptedConfigs)) {
                        if (!configs[id]) {
                            configs[id] = decryptedConfigs[id];
                            loaded++;
                        }
                    }

                    dialog.showMessageBox({
                        title: "FunnelAI",
                        message: `Successfully loaded ${loaded} from the device.`,
                        type: "info"
                    });
                    ICPSendToMain({
                        Opcode: "LOADED_FROM_DEVICE",
                        Data: {}
                    });
                } else {
                    dialog.showMessageBox(ElectronWindow, {
                        title: "FunnelAI",
                        message: "Failed to load the browsers from the device.\n\nQuick Fixes:\n1. Resync the browsers on the target device",
                        type: "error"
                    })
                }
            } catch (er) {
                dialog.showMessageBox(ElectronWindow, {
                    title: "FunnelAI",
                    message: "Failed to load the browsers from the device.\n\nQuick Fixes:\n1. Resync the browsers on the target device",
                    type: "error"
                })
            }
            //SendWebsocket({ Opcode: 46, Data }); FUFU NIGGER 123D
            break;  
        }

        case "SET_FOCUS_BASED_OPACITY": {
            const { Enabled } = Data;
            appconfig.focus_based_opacity = Enabled;
            SaveAppConfig();
            break;
        }

        case "MASS_EDIT_SNAPCHAT": {
            const { Options, SelectedBrowsers } = Data;
            let AppliedTo = 0;

            for (const [ID, Enabled] of Object.entries(SelectedBrowsers)) {
                if (!Enabled) {
                    continue;
                }

                const config = configs[ID];
                if (!config) {
                    continue;
                }

                if ((config.platform || "snapchat") !== "snapchat") {
                    continue;
                }

                if (Options.hasOwnProperty("model")) {
                    config.bot_settings.selected_model = Options.model === "Select a model" ? undefined : Options.model;
                }

                if (Options.hasOwnProperty("model_city")) {
                    try {
                        const packet = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(Options.model_city)}&format=json&addressdetails=1`, {
                            method: "GET",
                            headers: {
                                ["User-Agent"]: AccountInfo.id
                            }
                        });
                        const cities = await packet.json();
                        if (!cities.length) {
                            break;
                        }

                        const { lat, lon } = cities.shift();
                        
                        const packet2 = await fetch(`http://127.0.0.1:8081/api/utils/city/${lat}/${lon}`, {
                            method: "GET",
                            headers: {
                                ["Authorization"]: UserAPIKey
                            }
                        });

                        const { success, timezone } = await packet2.json();
                        if (success) {
                            config.bot_settings.model_timezone = timezone;
                            config.bot_settings.model_city = Options.model_city;
                        }
                    } catch {
                        break;
                    }
                }

                if (Options.hasOwnProperty("enable_friends")) {
                    config.bot_settings.enable_friend_task = Options.enable_friends;
                }

                if (Options.hasOwnProperty("ignore_pending")) {
                    config.bot_settings.ignore_pending = Options.ignore_pending;
                }

                if (Options.hasOwnProperty("daily_limit")) {
                    config.bot_settings.friends_daily_limit = Options.daily_limit;
                }

                if (Options.hasOwnProperty("maximum_pending_requests")) {
                    config.bot_settings.maximum_pending_requests = Options.maximum_pending_requests
                }

                if (Options.amount_to_accept) {
                    config.bot_settings.add_x_friends.start = Options.amount_to_accept.left;
                    config.bot_settings.add_x_friends.end = Options.amount_to_accept.right;
                }

                if (Options.accept_every) {
                    config.bot_settings.add_friends_every.start = Options.accept_every.left;
                    config.bot_settings.add_friends_every.end = Options.accept_every.right;
                }

                // messaging

                if (Options.hasOwnProperty("messaging_enabled")) {
                    config.bot_settings.messaging_enabled = Options.messaging_enabled;
                }

                if (Options.hasOwnProperty("background_mode")) {
                    config.bot_settings.background_mode = Options.background_mode;
                }

                if (Options.hasOwnProperty("match_location")) {
                    config.bot_settings.match_location = Options.match_location;
                }

                if (Options.keystroke_delay) {
                    config.bot_settings.keystroke_delay.start = Options.keystroke_delay.left;
                    config.bot_settings.keystroke_delay.end = Options.keystroke_delay.right;
                }

                if (Options.hasOwnProperty("opening_message")) {
                    config.bot_settings.message_opening = Options.opening_message;
                }

                if (Options.hasOwnProperty("call_reply")) {
                    config.bot_settings.call_response = Options.call_reply;
                }

                if (Options.hasOwnProperty("voice_note_reply")) {
                    config.bot_settings.voice_note_response = Options.voice_note_reply;
                }

                if (Options.hasOwnProperty("follow_up_duration")) {
                    config.bot_settings.follow_up_duration = Options.follow_up_duration;
                }

                if (Options.hasOwnProperty("follow_up_message")) {
                    config.bot_settings.follow_up_message = Options.follow_up_message;
                }

                if (Options.hasOwnProperty("send_random_snaps")) {
                    config.bot_settings.send_random_snaps = Options.send_random_snaps;
                }

                if (Options.hasOwnProperty("main_snap_percentage")) {
                    config.bot_settings.main_snap_percentage = Options.main_snap_percentage;
                }

                if (Options.hasOwnProperty("sexy_snap_percentage")) {
                    config.bot_settings.sexy_snap_percentage = Options.sexy_snap_percentage;
                }

                if (Options.hasOwnProperty("wait_x_seconds")) {
                    config.bot_settings.seconds_before_opening = Options.wait_x_seconds;
                }

                AppliedTo++;
            }

            dialog.showMessageBox(ElectronWindow, {
                title: "FunnelAI",
                message: `Successfully applied a mass edit to ${AppliedTo} browsers.`,
                type: "info"
            });
            ICPSendToMain({
                Opcode: "MASS_EDIT_FINISHED",
                Data: {}
            });
            break;
        }

        case "MASS_EDIT_INSTAGRAM": {
            const { Options, SelectedBrowsers } = Data;
            let AppliedTo = 0;

            for (const [ID, Enabled] of Object.entries(SelectedBrowsers)) {
                if (!Enabled) {
                    continue;
                }

                const config = configs[ID];
                if (!config) {
                    continue;
                }

                if ((config.platform || "instagram") !== "instagram") {
                    continue;
                }

                if (Options.hasOwnProperty("model")) {
                    config.bot_settings.selected_model = Options.model === "Select a model" ? undefined : Options.model;
                }

                if (Options.hasOwnProperty("model_city")) {
                    try {
                        const packet = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(Options.model_city)}&format=json&addressdetails=1`, {
                            method: "GET",
                            headers: {
                                ["User-Agent"]: AccountInfo.id
                            }
                        });
                        const cities = await packet.json();
                        if (!cities.length) {
                            break;
                        }

                        const { lat, lon } = cities.shift();
                        
                        const packet2 = await fetch(`http://127.0.0.1:8081/api/utils/city/${lat}/${lon}`, {
                            method: "GET",
                            headers: {
                                ["Authorization"]: UserAPIKey
                            }
                        });

                        const { success, timezone } = await packet2.json();
                        if (success) {
                            config.bot_settings.model_timezone = timezone;
                            config.bot_settings.model_city = Options.model_city;
                        }
                    } catch {
                        break;
                    }
                }

                if (Options.hasOwnProperty("enable_friends")) {
                    config.bot_settings.enable_friend_task = Options.enable_friends;
                }

                if (Options.hasOwnProperty("ignore_pending")) {
                    config.bot_settings.ignore_pending = Options.ignore_pending;
                }

                if (Options.hasOwnProperty("daily_limit")) {
                    config.bot_settings.friends_daily_limit = Options.daily_limit;
                }

                if (Options.hasOwnProperty("maximum_pending_requests")) {
                    config.bot_settings.maximum_pending_requests = Options.maximum_pending_requests
                }

                if (Options.amount_to_accept) {
                    config.bot_settings.add_x_friends.start = Options.amount_to_accept.left;
                    config.bot_settings.add_x_friends.end = Options.amount_to_accept.right;
                }

                if (Options.accept_every) {
                    config.bot_settings.add_friends_every.start = Options.accept_every.left;
                    config.bot_settings.add_friends_every.end = Options.accept_every.right;
                }

                // messaging

                if (Options.hasOwnProperty("messaging_enabled")) {
                    config.bot_settings.messaging_enabled = Options.messaging_enabled;
                }

                if (Options.hasOwnProperty("match_location")) {
                    config.bot_settings.match_location = Options.match_location;
                }

                if (Options.keystroke_delay) {
                    config.bot_settings.keystroke_delay.start = Options.keystroke_delay.left;
                    config.bot_settings.keystroke_delay.end = Options.keystroke_delay.right;
                }

                if (Options.hasOwnProperty("opening_message")) {
                    config.bot_settings.message_opening = Options.opening_message;
                }

                if (Options.hasOwnProperty("call_reply")) {
                    config.bot_settings.call_response = Options.call_reply;
                }

                if (Options.hasOwnProperty("voice_note_reply")) {
                    config.bot_settings.voice_note_response = Options.voice_note_reply;
                }

                if (Options.hasOwnProperty("follow_up_duration")) {
                    config.bot_settings.follow_up_duration = Options.follow_up_duration;
                }

                if (Options.hasOwnProperty("follow_up_message")) {
                    config.bot_settings.follow_up_message = Options.follow_up_message;
                }

                if (Options.hasOwnProperty("send_random_snaps")) {
                    config.bot_settings.send_random_snaps = Options.send_random_snaps;
                }

                if (Options.hasOwnProperty("main_snap_percentage")) {
                    config.bot_settings.main_snap_percentage = Options.main_snap_percentage;
                }

                if (Options.hasOwnProperty("sexy_snap_percentage")) {
                    config.bot_settings.sexy_snap_percentage = Options.sexy_snap_percentage;
                }

                if (Options.hasOwnProperty("wait_x_seconds")) {
                    config.bot_settings.seconds_before_opening = Options.wait_x_seconds;
                }

                AppliedTo++;
            }

            dialog.showMessageBox(ElectronWindow, {
                title: "FunnelAI",
                message: `Successfully applied a mass edit to ${AppliedTo} browsers`,
                type: "info"
            });
            ICPSendToMain({
                Opcode: "MASS_EDIT_FINISHED",
                Data: {}
            });
            break;
        }

        case "DELETE_ALL_BROWSERS": {
            const { Platform } = Data;

            const choice = dialog.showMessageBoxSync(ElectronWindow, {
                title: "FunnelAI",
                message: "Are you sure you want to delete all of your browsers?\n\nYou will not be able to recover them.",
                type: "warning",
                buttons: ["Yes", "No"]
            });

            if (choice === 1) {
                break;
            }

            const secondWarning = dialog.showMessageBoxSync(ElectronWindow, {
                title: "FunnelAI",
                message: "Are you 100% sure you want to delete all of your browsers?\n\nYou will not be able to recover them.",
                type: "warning",
                buttons: ["Yes", "No"]
            });

            if (secondWarning === 1) {
                break;
            }

            let count = 0;
            for (const config of Object.values(configs)) {
                if ((config.platform || "snapchat") !== Platform) {
                    continue;
                }

                const ID = config.id;
                const shared = BrowserCommunication[ID]; 
                if (shared) {
                    SetBrowserState(ID, false)
                    shared.sendMessage({ Opcode, Data });
                }

                if (existsSync(path.join(__appdir, `/storage/browser-states/${ID}`))) {
                    rmSync(path.join(__appdir, `/storage/browser-states/${ID}`), { recursive: true, force: true, maxRetries: 4 });
                }

                delete configs[ID];
                count++;
            }
            SaveConfigs();

            dialog.showMessageBox(ElectronWindow, {
                title: "FunnelAI",
                message: `Successfully deleted ${count} browsers.`,
                type: "info"
            });
            break;
        }

        default:
            break;
    }
});

ipcMain.handle("GET_BROWSER_STATUS", async (event, ID) => {
    const OpenData = BrowserOpenStatus[ID]; 
    if (!OpenData) {
        return { Open: false, LoggedIn: false }
    }

    let LoggedIn;
    let BrowserOpen;

    try { 
        if (OpenData && typeof(OpenData) == "object") {
            LoggedIn = OpenData.LoggedIn;
            BrowserOpen = OpenData.BrowserOpen;
        }
    } catch (er) {
        console.log(er);
        return { Open: false, LoggedIn: false }
    }

    return { Open: BrowserOpen, LoggedIn: LoggedIn }
});

ipcMain.handle("account", (event) => {
    return AccountInfo;
});

ipcMain.handle("device", () => {
    return {
        name: DeviceName,
        id: DeviceID
    };
});

ipcMain.handle("synctime", () => {
    return LastServerSynced;
});

ipcMain.handle("getconfigs", () => {
    return configs;
});

ipcMain.handle("models", () => {
    return models;
});

ipcMain.handle("PORT", () => {
    return FASTIFY_PORT;
});

ipcMain.handle("getdevices", async () => {
    const packet = await fetch(("https://funnelai.bot/api/user/devices"), {
        method: "GET",
        headers: {
            ["Authorization"]: UserAPIKey
        }
    });

    if (packet.status !== 200) {
        return;
    }

    const result = await packet.json();
    return result;
});

app.whenReady().then(async () => { 
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        dialog.showMessageBoxSync({
            title: "FunnelAI",
            message: "Another instance of FunnelAI is already open",
            type: "warning"
        });
        return process.exit(0);
    }

    await fastify.register(cors, {
        origin: "*"
    });

    fastify.register(require("@fastify/static"), {
        root: path.join(__appdir, "/storage/model-images")
    });

    fastify.get("/version", (request, reply) => reply.send(CURRENT_VERSION));

    fastify.get("/config/:id", async (request, reply) => {
        const { id } = request.params;

        const cfg = configs[id];
        if (!cfg) {
            return reply.status(400).send({ error: "Unknown Config" });
        }

        reply.send({
            analytics: cfg.analytics,
            name: cfg.name,
            notes: cfg.remarks,
            user_agent: cfg.user_agent,
            proxy: cfg.proxy
        });
    });

    fastify.post("/callback", (request, reply) => {
        const { APIKey, CallbackToken } = request.body;
        if (!APIKey || !CallbackToken) {
            return;
        }

        if (CallbackToken !== LoginToken) {
            return;
        }

        DataStorage.WriteFile(path.join(ROAMING_DIR, "user.bin"), APIKey, ("33a7a934-91ff-4f9c-8f8a-26f9068c7f2e"))
        //writeFileSync(path.join(ROAMING_DIR, "user.bin"), APIKey);
        app.relaunch({ args: [] });
        app.exit();
        reply.send({ success: true });
    });

    fastify.listen({ port: 0 }, (err, address) => {
        if (err) {
            //backupConsole(err);
            dialog.showMessageBoxSync({
                title: "FunnelAI",
                message: "Failed to start FunnelAI (Error Code: 0x34)\nContact support for assistance.",
                type: "warning"
            });
            return process.exit(1);
        }
        FASTIFY_PORT = fastify.server.address().port;
        console.log(`Fastify listening to port ${FASTIFY_PORT}`);
        CreateWindow();
    });

    setInterval(async () => {
        for (const ID of Object.keys(configs)) {
            const shared = BrowserCommunication[ID];

            if (shared) {
                let ResetEvery = (configs[ID]?.platform || "snapchat") == "snapchat" ? +appconfig.reset_browsers_every : +appconfig.reset_browsers_every_instagram
                // Reload (cba renaming old config name)
                if (ResetEvery !== 0) {
                    let BrowserOpen;
                    let LoggedInTime;
                    let BrowserOpenTime;

                    try {
                        const OpenData = BrowserOpenStatus[ID]; 
                        if (OpenData && typeof(OpenData) == "object") {
                            BrowserOpen = OpenData.BrowserOpen;
                            LoggedInTime = OpenData.LoggedInTime;
                            BrowserOpenTime = OpenData?.BrowserOpenTime;
                        }
                    } catch (er) {
                        logtail.error(er.toString(), { name: "0xxxxxdfsd" }, er);
                        return;
                    }

                    if (BrowserOpen && LoggedInTime) {
                        const RestartAt = new Date(LoggedInTime);
                        RestartAt.setMinutes(RestartAt.getMinutes() + ResetEvery);
                        
                        if (BrowserOpenTime && (appconfig?.actual_restart_browsers_every > 0)) {
                            const RestartActualAt = new Date(BrowserOpenTime);
                            RestartActualAt.setMinutes(RestartActualAt.getMinutes() + (+appconfig?.actual_restart_browsers_every));

                            const config = configs[ID];

                            if (Date.now() > RestartActualAt.getTime()) {
                                try {
                                    shared.sendMessage({ Opcode: "KILL_BROWSER", Data: {} });
                                    await wait(10000);
                                    LaunchBrowser(config, models[config.bot_settings.selected_model], IgnoreLists[config.bot_settings.selected_model]);
                                } catch (er) {
                                    logtail.error(er.toString());
                                }
                            }
                        }


                        if (Date.now() > RestartAt.getTime()) {
                            try {
                                shared.sendMessage({ Opcode: "RELOAD_PAGE", Data: {} });
                                await wait(500);
                            } catch (er) {
                                logtail.error(er.toString(), { name: "0xxxxxdfsd" }, er);
                            }
                        }
                    }
                }

                /*
                if (+appconfig.actual_restart_browsers_every !== 0) {
                    let BrowserOpen;
                    let LoggedInTime;

                    try {
                        let Data = shared.checkBrowserOpen();
                        BrowserOpen = Data.BrowserOpen;
                        LoggedInTime = Data.LoggedInTime;
                    } catch (er) {
                        logtail.error(er, { name: "0xxxxxdfsd" });
                        return;
                    }

                    if (BrowserOpen && LoggedInTime) {
                        const RestartAt = new Date(LoggedInTime);
                        RestartAt.setMinutes(RestartAt.getMinutes() + +appconfig.actual_restart_browsers_every);
    
                        if (Date.now() > RestartAt.getTime()) {
                            try {
                                await shared.forcefulShutdown();
                                await browser(configs[ID], models[configs[ID].bot_settings.selected_model], IgnoreLists[configs[ID].bot_settings.selected_model], shared_memory, SendWebsocket, ICPSendToMain, AICreateResponse, AIDetermineStage, AIDetermineImage, appconfig, browserScripts, logtail, GetAccountInfo);
                            } catch (er) {
                                logtail.error(er, { name: "0xxxsadadasd" });
                                return;
                            }
                        }
                    }
                }
                */
            }
        }
    }, 60000);
});

app.on("window-all-closed", () => {
    app.quit();
});

process.on("uncaughtException", (error) => {
    console.log(error);
    logtail.error(error.toString(), { type: "uncaughtException" }, error);
    process.exit(1);
});

process.on("unhandledRejection", (error) => {
    logtail.error(error.toString(), { type: "unhandledRejection" }, error);
});

process.on("exit", () => {
    if (UserAPIKey) {
        SaveConfigs();
    }
});

process.on("SIGINT", () => {
    if (UserAPIKey) {
        SaveConfigs();
    }
});

process.on("SIGTERM", () => {
    if (UserAPIKey) {
        SaveConfigs();
    }
});

setInterval(() => {
    if (UserAPIKey) {
        SaveConfigs();
    }
}, 60000)