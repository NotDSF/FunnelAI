const playfast = require("./playfast");
const chromium = new playfast();
const { readFileSync, existsSync } = require("node:fs");
//const { parentPort, workerData } = require("worker_threads");

//const parsechats = require("../scripts/parsechats");
let fakecamera
let removecallframe;
let browserUI
let userControls

let removeWatermark
let getMessages
let sendMessage
let rawSendMessage
let sendSnap
let getSnaps
let openSnap
let addFriends
let tempDelays
let chatOpen
let getChats
let blurMedia
let validateInjection
let updateRetenion
let getUserData
let validateCrash


let blurMediaCycleScript
let scrollScript;
//let serviceWorkerScript;
let initScript;
let phaseIconScript;
let createNotificationScript;
let getScrollData;
let saveMessage;
let getMessagesBackground;
let exitConversationBackground;
let uploadStory;
//let deleteMessage;
let getChatsRaw;
let openChat;
let closeChat;


const path = require("node:path");
const { EventEmitter } = require("node:events");
const { Random } = require("random");
const { DateTime } = require("luxon");
const logtail = require("./logtail");

//const AIClass = require("./AI.js");

const rng = new Random();
//const AI = new AIClass();

//const OriginalInstructions = readFileSync(path.join(__appdir, "modal-instructions.txt"), "utf-8");

async function wait(ms) {
    await new Promise(async (resolve, reject) => setTimeout(resolve, ms));
}

/*
async function onceWithTimeout(emitter, eventName, timeoutMs) {
    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Timeout waiting for event')), timeoutMs);
    });

    const result = await Promise.race([
        once(emitter, eventName),
        timeoutPromise
    ]);

    clearTimeout(timeout);
    return result;
}
*/

async function waitForPromiseWithTimeout(promise, timeoutMs) {
    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Timeout waiting for event')), timeoutMs);
    });

    const result = await Promise.race([
        promise,
        timeoutPromise
    ]);

    clearTimeout(timeout);
    return result;
}

function DetermineSpintax(text) {
    const options = text.split("|");
    if (options.length <= 1) {
        return text;
    }
    return options[rng.int(0, options.length - 1)];
}

/*
function ConversationIDToObject(str) {
    const hex = str.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return {
        id: bytes,
        str
    }
}
*/

const PhaseToEmoji = {
    ["phase 1"]: "💬",
    ["phase 2"]: "😊",
    ["phase 3"]: "❤️",
    ["phase 4"]: "🫰",
    ["phase 5"]: "🫰"
}

const PhaseToTooltip = {
    ["phase 1"]: "Phase 1 (Small Talk)",
    ["phase 2"]: "Phase 2 (Building Rapport)",
    ["phase 3"]: "Phase 3 (Sexting)",
    ["phase 4"]: "Phase 4 (CTA)",
    ["phase 5"]: "Phase 5 (CTA)"
}

const ProxyHTTPErrors = [
    "net::ERR_PROXY_CONNECTION_FAILED",
    "net::ERR_TUNNEL_CONNECTION_FAILED",
    "net::ERR_PROXY_AUTH_REQUESTED",
    "net::ERR_PROXY_CERTIFICATE_INVALID",
    "net::ERR_HTTP_RESPONSE_CODE_FAILURE"
]

const ChatStatuses = {
    Opened: +("15"),
    Received: +("35"),
    NewChatsAndSnaps: +("13"),
    NewChat: +("14"),
    NewSnapAndReaction: +("28"),
    NewSnap: +("26"),
    Calling: +("1"),
    NewVoiceNote: +("18"),
    SayHi: +("31"),
    Typing: +("3"),
    CloseChat: ("Close Chat"),
    Screenshot: +("9"),
    ChatReaction: +("16"),
    ChatRemovedReaction: +("18")
}

const AllowedBrowserEvents = new Set([
    ("exitConversation"),
    ("stop"),
    ("onFetchAndSyncFeedComplete"),
    ("fetchConversationWithMessagesPaginated"),
    ("setUserData"),
    ("CaptureFriends"),
    "CaptureUserState" // custom (non snapchjat)
]);

const SameSiteMap = {
    ["no_restriction"]: "None",
    ["unspecified"]: "None",
    ["strict"]: "Strict",
    ["lax"]: "Lax",

            // pretty dumb, but when config saves could override with the new fixed values
    ["None"]: "None",
    ["Strict"]: "Strict",
    ["Lax"]: "Lax"
}

const priority = {
    "phase 2": 1,
    "phase 3": 2
}

function SendToWorker(data) {
    try {
        process.send(JSON.stringify(data))
    } catch (er) {
        console.log(er);
    }
}

const funnelEventVariable = ("bcdacaaeece")
//const funnelEventVariable = crypto.randomUUID().replaceAll(/[-\d]/g, "");
const funnelGlobalVariableName = ("NepiRvpQzF"); // Used to identify the client, changes will cause cache restart
const AIResponsePromises = new Map();

function WorkOutMessageTimeout(RightDelay, Message) {
    return RightDelay ? Message.length * RightDelay : 60000
}

function ICPBroadcast(Value) {
    SendToWorker({ Opcode: "ICPBroadcast", Data: Value });
}

function AICreateResponse(Messages, Settings, IncludeMoreMessages) {
    let UUID = crypto.randomUUID();

    for (const message of Messages) {
        delete message.messageId;
    }


    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });

    AIResponsePromises.set(UUID, resolve);
    SendToWorker({ Opcode: "CreateResponse", Data: { Messages, Settings, IncludeMoreMessages, UUID } });
    return promise;
}

function AIDetermineStage(Messages, Settings) {
    let UUID = crypto.randomUUID();

    for (const message of Messages) {
        delete message.messageId;
    }

    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });


    AIResponsePromises.set(UUID, resolve);
    SendToWorker({ Opcode: "DetermineStage", Data: { Messages, Settings, UUID } });
    return promise;
}

function AIDetermineImage(Images, Messages, SentImages) {
    let UUID = crypto.randomUUID();

    for (const message of Messages) {
        delete message.messageId;
    }


    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });


    AIResponsePromises.set(UUID, resolve);
    SendToWorker({ Opcode: "DetermineImage", Data: { Images, Messages, SentImages, UUID } });
    return promise;
}

function InternalCheckIgnored(username) {
    let UUID = crypto.randomUUID();

    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });

    AIResponsePromises.set(UUID, resolve);
    SendToWorker({ Opcode: "IS_IGNORED", Data: { username, UUID } });
    return promise;
}

function WSC(Data) {
    SendToWorker({ Opcode: "WSC", Data });
}

function createNotification(Data) {
    SendToWorker({ Opcode: "createNotification", Data })
}

async function wait(ms) {
    await new Promise(async (resolve, reject) => setTimeout(resolve, ms));
}

let LoggedIn;

let getBrowserCookies;
let setWebcam;
let storyUpload;
let getFriends;
let reloadPage;
let resetFriendCycle;
let blurMediaCycle;
let phaseUpdateCycle;

function SharedHandler(Value) {
    const { UUID, Data } = Value;
    switch (Data.Opcode) {
        /*
        case "CHECK_BROWSER_OPEN": {
            SendToWorker({ Opcode: "SHARED", Data: { UUID, Data: { LoggedIn, BrowserOpen, LoggedInTime } } });
            break;
        }
        */
        case "GET_FRIENDS": {
            SendToWorker({ Opcode: "SHARED", Data: { UUID, Data: getFriends() } });
            break
        }
        default:
            break;
    }
}


function FocusWindowAndOpenBrowser(Data) {
    SendToWorker({ Opcode: "OpenWindow", Data: { ID: Data } });
}

function containsArabic(text) {
  // The primary Unicode range for Arabic characters is U+0600 to U+06FF.
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
}


let context;
let config;
let ModelConfiguration;

const JSONDecode = require("./jsondecode");

process.on("message", async (Value) => {
    let Decrypted;
    try {
        Decrypted = JSONDecode(Buffer.from(Value?.data))
    } catch (er) {
        console.log(er);
        return;
    }
    
    if (typeof(Decrypted) !== "object") {
        return;
    }

    const { Opcode, Data } = Decrypted;
    switch (Opcode) {
        case "SHARED": {
            SharedHandler(Data);
            break;
        }
        case "KILL_BROWSER": {
            if (!context) {
                return process.exit(0);
            }

            config.cookies = await context.cookies();
            await context.close();
            break;
        }
        case "SET_WEBCAM": {
            if (!setWebcam) {
                break;
            }
            setWebcam(Data);
            break;
        }
        case "UPLOAD_STORY": {
            if (!uploadStory) {
                break;
            }
            storyUpload(Data);
            break;
        }
        case "RELOAD_PAGE": {
            if (!reloadPage) {
                break;
            }
            reloadPage();
            break;
        }
        case "BOT_SETTINGS": {
            const { bot_settings, model } = Data;

            config.bot_settings = bot_settings;
            ModelConfiguration = model;
            break;
        }
        case "FRIENDS_ACCEPT_NOW": {
            resetFriendCycle();
            break;
        }
        case "RESTART_BROWSER": {
            config.cookies = await context.cookies();

            const pages = await context.pages;
            for (const page of pages) {
                await page.close({ runBeforeUnload: true });
            }
            break;
        }
        case "ASYNC_RESPONSE": {
            AIResponsePromises.get(Data.UUID)(Data.Data);
            AIResponsePromises.delete(Data.UUID);
            break;
        }
        case "PHASE_ICONS": {
            const { Enabled } = Data;
            if (phaseUpdateCycle) {
                phaseUpdateCycle(Enabled);
            }
            break;  
        }
        case "BLUR_MEDIA": {
            const { Enabled } = Data;
            if (blurMediaCycle) {
                blurMediaCycle(Enabled);
            }
            break;
        }
        case "START": {
            break;
        }
        default:
            console.log(Decrypted);
            break;
    }
});

let IgnoreList = new Set();
let NotIgnoredList = new Set();
let AccountInfo;

module.exports = async (bconfig, _ModelConfig, appconfig, browserScripts, ROAMING_DIR, __appdir, accinfo, UITimestamp, FASTIFY_PORT) => {
    config = bconfig;
    AccountInfo = accinfo;
    ModelConfiguration = _ModelConfig;
    logtail.setAuth(AccountInfo[("APIKey")]);

    const backupConsole = console.log;


    if (Date.now() / 1000 - +UITimestamp > 60) {
        return process.exit(0);
    }

    if (AccountInfo[("Admin")]) {
        console.log = backupConsole;
    }

    function safeClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function SaveConfig() {
        try {
            const Data = {
                chats: config?.chats,
                analytics: config?.analytics,
                last_login: config?.last_login,
                persistent_tabs: config?.persistent_tabs,
                cache: config?.cache,
                add_friends_next_cycle: config?.bot_settings?.add_friends_next_cycle,
                cookies: config?.cookies
            }
            SendToWorker({ Opcode: "CONFIG", Data: safeClone(Data) });
        } catch (er) {
            console.log(er);
        }
    }

    const Event = new EventEmitter();
    

    let ConfigID = config.id;
    //let config = globalThis[ConfigID]; 
    //let ModalInstructions = readFileSync(path.join(__appdir, "modal-instructions.txt"), "utf-8");
    let FirstLogin = false;

    if (!ModelConfiguration) {
        createNotification({
            title: "FunnelAI",
            message: ("There isn't a model configured to this browser"),
            type: "warning"
        });
        process.exit(0);
        return;
    }

    for (const [Key, Data] of Object.entries(browserScripts)) {
        try {
            browserScripts[Key] = new Function(Data);
        } catch (er) {          
            browserScripts[Key] = ("() => {}");
        }
    }

    if (!fakecamera) {
        fakecamera = browserScripts[("vyDS")]();
        removecallframe = browserScripts[("IUDI")]();
        removeWatermark = browserScripts[("dDlK")]();
        getMessages = browserScripts[("vRXa")]();
        getSnaps = browserScripts[("LxOP")]();
        getUserData = browserScripts[("UJkK")]();
        //homeTab = browserScripts[("Qsyn")]();
        openSnap = browserScripts[("fhPb")]();
        sendSnap = browserScripts[("cYDu")]();
        tempDelays = browserScripts[("yDtz")]();
        sendMessage = browserScripts[("twdZ")]();
        updateRetenion = browserScripts[("UMsw")]();
        rawSendMessage = browserScripts[("USjg")]();
        openSnap = browserScripts[("fhPb")]();
        getSnaps = browserScripts[("LxOP")]();
        blurMedia = browserScripts[("DXGD")](); 
        chatOpen = browserScripts[("FENr")]();
        getChats = browserScripts[("YWCH")]();
        userControls = browserScripts[("XYKc")]();
        browserUI = browserScripts[("tWDi")]();
        addFriends = browserScripts[("kzCZ")](); 
        validateCrash = browserScripts[("wNjk")]();
        validateInjection = browserScripts[("SQdv")]();
        blurMediaCycleScript = browserScripts[("UUoJ")]();
        scrollScript = browserScripts[("tHxx")]();
        //serviceWorkerScript = browserScripts[("kXqP")]();
        initScript = browserScripts[("Eriv")]();
        phaseIconScript = browserScripts[("wLxP")]();
        createNotificationScript = browserScripts[("RBzC")]();
        getScrollData = browserScripts[("SEAK")]();
        saveMessage = browserScripts[("EEve")]();
        getMessagesBackground = browserScripts[("ykAm")]();
        exitConversationBackground = browserScripts[("IWVf")]();
        uploadStory = browserScripts[("Za92o")]();
        //deleteMessage = browserScripts[("n1GD72q6WFywe0")]();
        getChatsRaw = browserScripts[("cImfyWhWWw8CD1")]();
        openChat = browserScripts[("PSsyE6OC5L41ko")]();
        closeChat = browserScripts[("QNLV7rOzXAqXfL")]();
    }

    Event.on(("stop"), () => {
        console.log("Logged out, or page reloaded");
        LoggedIn = false;
        SendToWorker({ Opcode: "LOGGED_IN_STATUS", Data: { LoggedIn: false } })

        ICPBroadcast(({
            Opcode: "STATUS_UPDATE",
            Data: {
                ID: ConfigID,
                Status: "Logged out of Snapchat",
                LoggedIn
            }
        }));

        ICPBroadcast(({
            Opcode: "LOGGED_OUT",
            Data: {
                ID: ConfigID
            }
        }));
    });

    Event.on(("setUserData"), async () => {
        if (!LoggedIn) {
            console.log("Logged back in");
            LoggedIn = true;
            SendToWorker({ Opcode: "LOGGED_IN_STATUS", Data: { LoggedIn: true } })
        }

        if (!FirstLogin) {
            console.log("Logged In, Injected, and Loaded.");
            FirstLogin = true;
        }
    });

    /*
    function SaveConfig() {
        const json = JSON.parse(readFileSync(path.join(__appdir, "storage/configs.json"), "utf-8"));
        json[ConfigID] = config;
        writeFileSync(path.join(__appdir, "storage/configs.json"), JSON.stringify(json));
    }
    */

    async function CheckIfUserIgnored(username) {
        if (IgnoreList.has(username)) {
            return true;
        }

        if (NotIgnoredList.has(username)) {
            return false;
        }

        const result = await InternalCheckIgnored(username);
        if (result) {
            IgnoreList.add(username);
        } else {
            NotIgnoredList.add(username);
        }

        return result;    
    }

    function AddUserToIgnoreList(username) {
        IgnoreList.add(username);
        NotIgnoredList.delete(username);
        WSC({ Opcode: 15, Data: { id: ModelConfiguration.id, username } });
    }

    function AddUsersToIgnoreList(usernames) {
        for (const username of usernames) {
            IgnoreList.add(username);
            NotIgnoredList.delete(username);
        }
        WSC({ Opcode: 37, Data: { id: ModelConfiguration.id, usernames } });
    }

    /*
    function AddUserToSubscribedList(username) {
        appendFileSync(path.join(__appdir, "subscribed-list.txt"), `\n${username}`);
    }
    */

    function AddLastLogin() {
        config.last_login = Date.now();
        SaveConfig();
    }

    function IncrementFriends(by) {
        config.analytics.friends.total += by;

        if (Date.now() > config.analytics.friends.next_update) {
            const Tmr = new Date();
            Tmr.setHours(Tmr.getHours() + 24);
            config.analytics.friends.next_update = Tmr.getTime(); 
            config.analytics.friends.today = 0;
        }

        config.analytics.friends.today += by;
        SaveConfig();
    }

    function IncrementTotalFriends(amount) {
        if (amount > config.analytics.all_friends.total) {
            const difference = amount - config.analytics.all_friends.total;
            config.analytics.all_friends.total += difference;
            config.analytics.all_friends.today += difference;
        }

        if (Date.now() > config.analytics.all_friends.next_update) {
            const Tmr = new Date();
            Tmr.setHours(Tmr.getHours() + 24);
            config.analytics.all_friends.next_update = Tmr.getTime(); 
            config.analytics.all_friends.today = 0;
        }

        SaveConfig();
    }

    function IncrementMessages() {
        config.analytics.messages.total++;

        if (Date.now() > config.analytics.messages.next_update) {
            const Tmr = new Date();
            Tmr.setHours(Tmr.getHours() + 24);
            config.analytics.messages.next_update = Tmr.getTime(); 
            config.analytics.messages.today = 0;
        }

        config.analytics.messages.today++;
        SaveConfig();
    }

    function IncrementCTAShared() {
        config.analytics.cta_link_shared.total++;

        if (Date.now() > config.analytics.cta_link_shared.next_update) {
            const Tmr = new Date();
            Tmr.setHours(Tmr.getHours() + 24);
            config.analytics.cta_link_shared.next_update = Tmr.getTime(); 
            config.analytics.cta_link_shared.today = 0;
        }

        config.analytics.cta_link_shared.today++;
        SaveConfig();
    }

    function IncrementCTASubscribed() {
        config.analytics.cta_link_subscribed.total++;

        if (Date.now() > config.analytics.cta_link_subscribed.next_update) {
            const Tmr = new Date();
            Tmr.setHours(Tmr.getHours() + 24);
            config.analytics.cta_link_subscribed.next_update = Tmr.getTime(); 
            config.analytics.cta_link_subscribed.today = 0;
        }

        config.analytics.cta_link_subscribed.today++;
        SaveConfig();
    }

    function IncrementImages() {
        config.analytics.images.total++;

        if (Date.now() > config.analytics.images.next_update) {
            const Tmr = new Date();
            Tmr.setHours(Tmr.getHours() + 24);
            config.analytics.images.next_update = Tmr.getTime(); 
            config.analytics.images.today = 0;
        }

        config.analytics.images.today++;
        SaveConfig();
    }

    function IncrementConversations() {
        config.analytics.conversations.total++;

        if (Date.now() > config.analytics.conversations.next_update) {
            const Tmr = new Date();
            Tmr.setHours(Tmr.getHours() + 24);
            config.analytics.conversations.next_update = Tmr.getTime(); 
            config.analytics.conversations.today = 0;
        }

        config.analytics.conversations.today++;
        SaveConfig();
    }

    if (!config.analytics.conversations) {
        config.analytics.conversations = {
            total: Object.values(config.chats).length,
            today: 0,
            next_update: 0
        }
        SaveConfig();
    }

    // pressSequentially

    //internal_shared.createResponse = CreateResponse;
    //globalThis[`createResponse-${ConfigID}`] = CreateResponse;

    let CurrentBotStatus;
    function StatusUpdate(status) {
        ICPBroadcast(({
            Opcode: "STATUS_UPDATE",
            Data: {
                ID: ConfigID,
                Status: status,
                LoggedIn
            }
        }));
        CurrentBotStatus = status;
    }

    //internal_shared.determineStage = DetermineStage;
    //internal_shared.determineImage = DetermineImage;

    // globalThis[`determineStage-${ConfigID}`] = DetermineStage;
    // globalThis[`determineImage-${ConfigID}`] = DetermineImage;
    const ProxyChain = require("proxy-chain");

    let ProxySettings;
    switch (config.proxy.type) {
        case "HTTP Proxy": {
            const ProxyServer = await ProxyChain.anonymizeProxy(`http://${config.proxy.username}:${config.proxy.password}@${config.proxy.ip}:${config.proxy.port}`)
            ProxySettings = {
                server: ProxyServer,
                username: config.proxy.username,
                password: config.proxy.password,
                //URL: `http://${config.proxy.ip}:${config.proxy.port}:${config.proxy.username}:${config.proxy.password}`,
            }
            break;
        }

        
        case "SOCKS5 Proxy": {
            try {
                const ProxyServer = await ProxyChain.anonymizeProxy(`socks5://${config.proxy.username}:${config.proxy.password}@${config.proxy.ip}:${config.proxy.port}`);
                ProxySettings = {
                    server: ProxyServer
                }
            } catch (er) {
                logtail.error(er.toString());
                ICPBroadcast({
                    Opcode: ("FAILED_TO_LAUNCH"),
                    Data: {
                        ID: ConfigID,
                        Reason: "Check if the browsers proxy is valid. Error Code: 0x299"
                    }
                });
                return;
            }
            break;
        }
        

        default:
            break;
    }

    // format extensions
    let rawExtensionPaths = [];
    for (const { path: extensionPath, name } of appconfig.global_extensions) {
        if (!existsSync(extensionPath)) {
            createNotification({
                title: "FunnelAI",
                message: `Unable to load extension: ${name}\nThe extension doesn't exist on the disk.`,
                type: "warning"
            });
            continue;
        }
        rawExtensionPaths.push(extensionPath);
    }

    const BrowserArguments = [
        "--webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--force-webrtc-ip-handling-policy",
        "--disable-blink-features=AutomationControlled",
        "--mute-audio",
        "--disable-component-update",
        "--metrics-recording-only",
        "--disable-extensions",
        "--disable-blink-features=AutomationControlled",
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad', 
        '--disable-client-side-phishing-detection',
        '--disable-default-apps',
        '--disable-dev-shm-usage',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-print-preview',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--no-service-autorun',
        '--autoplay-policy=user-gesture-required',
        '--force-color-profile=srgb',
        '--disable-translate',
        '--disable-speech-api',
        '--disable-background-mode',
        "--disable-webgl",
        "--start-minimized",
        "--disable-gpu",
        "--wm-window-animations-disabled",
        "--noerrdialogs"
    ]

    if (rawExtensionPaths.length) {
        BrowserArguments.push(`--disable-extensions-except=${rawExtensionPaths.join(",")}`);
        BrowserArguments.push(`--load-extension=${rawExtensionPaths.join(",")}`);
    }

    try {
        context = await chromium.launchPersistentContext(
            path.join(ROAMING_DIR, `storage/browser-states/${config.id}`), 
            { 
                executablePath: path.join(__appdir, `storage/chrome-win/chrome.exe`),
                headless: false,
                viewport: null,
                colorScheme: appconfig.global_browser_theme ? appconfig.global_browser_theme : "dark",
                args: BrowserArguments,
                channel: "chrome",
                //locale: config.proxy.locale,
                proxy: ProxySettings,
                userAgent: config.user_agent,
                permissions: ["camera"],
                timezoneId: config.proxy.type !== "No Proxy" ? config.proxy.timezone : undefined,
                serviceWorkers: "allow",
                launchURL: ("https://funnelai.bot/dashboard/browser/") + `${encodeURI(config.id)}/${FASTIFY_PORT}`
            }
        );
    } catch (er) {
        console.log(er);
        if (context) {
            await context.close();
        }
    }

    let PersistentTabsInterval;
    let PhaseUpdateIntervalID;

    SendToWorker({ Opcode: "BROWSER_OPEN", Data: {} })

    ICPBroadcast(({
        Opcode: ("BROWSER_LAUNCHING"),
        Data: {
            ID: ConfigID
        }
    }));

    context.on("close", async () => {
        //GSetBrowserState(config.id, false);
        console.log("Browser Closed");
        SaveConfig();
        process.exit(0);
        BrowserOpen = false;
        LoggedIn = false;
        Event.removeAllListeners();
        clearInterval(PhaseUpdateIntervalID);
        clearInterval(PersistentTabsInterval);
        context.removeAllListeners();
        context = null;
        StatusUpdate("Browser Closed");

        if (config.proxy.type === "SOCKS5 Proxy" && ProxyAgent) {
            ProxyAgent.destroy();
            ProxyChain.closeAnonymizedProxy(ProxySettings.server, true)
            .then(() => {
                console.log("Closed");
            })
            .catch((er) => {
                console.log(er);
            });
        }

        if (config.proxy.type === "HTTP Proxy" && ProxyAgent) {
            ProxyAgent.destroy();
        }

        console.log("Cleaned up");
            //globalThis.CleanupMemory(ConfigID);
    });

    await context.addInitScript(initScript);
    
    if (config.cookies && config.cookies.length) {
        for (const cookie of config.cookies) {
            cookie.sameSite = SameSiteMap[cookie.sameSite] || "None";
        }

        if (config.cookies_id !== config.last_updated_cookies_id) {
            await context.addCookies(config.cookies);
            config.last_updated_cookies_id = config.cookies_id;
        }
    }
    
    // 238a973c730fdb7b

    // with de_DE
    // bb43515962e95540

    //globalThis[`context-${ConfigID}`] = context;
    getBrowserCookies = async function() {
        return new Promise(async (resolve, reject) => {
            resolve(await context.cookies());
        })
    }

    /*
    internal_shared.gracefulShutdown = async function() {
        return new Promise(async (resolve, reject) => {
            if (!context) {
                return resolve();
            }

            config.cookies = await context.cookies();

            const pages = await context.pages();
            for (const page of pages) {
                await page.close({ runBeforeUnload: true });
            }
            resolve();
        });
    }

    internal_shared.forcefulShutdown = async function() {
        try {
            if (!context) {
                return;
            }

            if (LoggedIn) {
                AddLastLogin();
            }

            config.cookies = await context.cookies();

            await context.unrouteAll({ behavior: "ignoreErrors" });
            await context.close();
        } catch (er) {
            logtail.error(er.toString(), { code: "0x34" }, er);
        }
    }
        */

    if (appconfig.persistent_tabs_enabled && config.persistent_tabs) {
        for (const URL of config.persistent_tabs) {
            const tmp = await context.newPage();
            await tmp.goto(URL);
        }
    }

    if (appconfig.automatically_open_urls) {
        for (const url of appconfig.automatically_open_urls) {
            try {
                new URL(url)
                const tmp = await context.newPage();
                await tmp.goto(url);
            } catch {
                continue;
            }
        }
    }

    PersistentTabsInterval = setInterval(async () => {
        if (LoggedIn && context) {
            const tabs = context.pages;        
            const rtabs = [];
            for (const tab of tabs) {
                const URL = await tab.url();
                if (URL) {
                    if (URL === "about:blank" || URL.includes("funnelai.bot") || URL.includes("snapchat.com") || (appconfig.automatically_open_urls || []).includes(URL)) {
                        continue;
                    }
                    rtabs.push(URL);
                }
            }

            config.persistent_tabs = rtabs;
            SaveConfig();
        }
    }, 3500);

    let page;
    //const session = await context.newCDPSession(page);

    //const { windowId } = await session.send("Browser.getWindowForTarget");

    //await session.send("Browser.setWindowBounds", {
       // windowId,
        //bounds: { windowState: "minimized" }
    //})

    async function memorySafeEvaluate(fn, args, timeout) {
        try {
            return await waitForPromiseWithTimeout(page.evaluate(fn, args), timeout || 10000);
        } catch (er) {
            logtail.error(er.toString(), { code: "0xfuck" }, er);
            console.log(er);
            return;
        }
    }

    async function memorySafeReload(...args) {
        try {
            const AmountofRAM = await page.evaluate(() => { return performance.memory.usedJSHeapSize });
            await page.goto(`http://127.0.0.1:8081/dashboard/browser/free/${AmountofRAM}`);
            StatusUpdate("Cleaning up RAM");
            await page.requestGC();
            //await wait(5000);
            //await page.goto(SNAPCHAT_WEB_URL);
        } catch (er) {
            logtail.error(er.toString(), { code: "0xbitch" }, er);
            return;
        }
    }

    let SnapchatUserData;
    let TimesRefreshed = 0;

    await context.exposeFunction("funnelCommunicate", async (event, username) => {
        switch (event) {
            case "GET_USER_DATA": {
                return config.chats[username];
            }

            case "IS_USER_IGNORED": {
                return await CheckIfUserIgnored(username);
            }

            case "DELETE_USER_DATA": {
                delete config.chats[username];
                SaveConfig();
                return true;
            }

            case "GET_BROWSER_UI_ESSENTIALS": {
                return {
                    BotEnabled: config.bot_settings.enabled,
                    FriendTaskEnabled: config.bot_settings.enable_friend_task,
                    Status: CurrentBotStatus
                }
            }

            case "ADD_TO_IGNORE_LIST": {
                const Ignored = await CheckIfUserIgnored(username);
                if (Ignored) {
                    memorySafeEvaluate(createNotificationScript, {
                        title: "We ran into an issue",
                        description: "This user is already on the ignore list 🤦‍♂️",
                        type: "error"
                    });
                    return;
                }

                AddUserToIgnoreList(username);
                memorySafeEvaluate(createNotificationScript, {
                    title: "Added to Ignore List",
                    description: "User has been added to the ignore list",
                    type: "success"
                });
                return;
            }

            case "REMOVE_FROM_IGNORE_LIST": {
                const Ignored = await CheckIfUserIgnored(username);
                if (!Ignored) {
                    memorySafeEvaluate(createNotificationScript, {
                        title: "We ran into an issue",
                        description: "This user isn't on the ignore list 🤦‍♂️",
                        type: "error"
                    });
                    return;
                }

                IgnoreList.delete(username);
                WSC({ Opcode: 16, Data: { id: ModelConfiguration.id, username } });

                memorySafeEvaluate(createNotificationScript, {
                    title: "Removed from Ignore List",
                    description: "User has been removed from the ignore list",
                    type: "success"
                });
                break;
            }

            case "MARK_CONVERTED": {
                AddUserToIgnoreList(username.username);
                StatusUpdate(`${username.username} Subscribed to CTA`);

                config.chats[username.userID].subscribed = true;
                WSC({ Opcode: 18, Data: { id: ModelConfiguration.id, username: username.username, converted: true } });
                SaveConfig();
                break;
            }

            case "MARK_UNCONVERTED": {
                IgnoreList.delete(username.username);
                WSC({ Opcode: 16, Data: { id: ModelConfiguration.id, username } });
                WSC({ Opcode: 18, Data: { id: ModelConfiguration.id, username: username.username, converted: false } });

                config.chats[username.userID].subscribed = false;
                SaveConfig();
                break;
            }

            case "ENABLE_BOT": {
                config.bot_settings.enabled = username;
                ICPBroadcast(({
                    Opcode: "ENABLE_BOT",
                    Data: {
                        ID: ConfigID,
                        Enabled: username
                    }
                }));
                SendToWorker({ Opcode: "ENABLE_BOT", Data: { ID: ConfigID, Enabled: username } });
                break;
            }

            case "ENABLE_FRIENDS_TASK": {
                config.bot_settings.enable_friend_task = username;
                ICPBroadcast(({
                    Opcode: "ENABLE_FRIENDS_TASK",
                    Data: {
                        ID: ConfigID,
                        Value: username
                    }
                }));
                SendToWorker({ Opcode: "ENABLE_FRIENDS_TASK", Data: { ID: ConfigID, Enabled: username } });
                break;
            }

            case "OPEN_IN_APP": {
                FocusWindowAndOpenBrowser(ConfigID);
                break;
            }

            case "WAITING_FOR_CACHE": {
                StatusUpdate(("[Initializing 3/3]: Please wait..."));
                break;
            }

            case "INJECTED_SUCCESSFULLY": {
                StatusUpdate(("[Initializing]: Successful"));
                break;
            }

            case "INJECTION_RELOADING": {
                TimesRefreshed = username;
                break;
            }

            case "INJECTION_RESET_CACHE": {
                delete config.cache;
                TimesRefreshed = 0;
                SaveConfig();

                break;
            }

            case "SEND_STATUS_UPDATE": {
                StatusUpdate(username);
                break;
            }

            case "GET_USER_DATA_FROM_USERID": {
                const mutableUsername = GetMutableUsernameFromID(username);
                const userData = config.chats[mutableUsername];

                const Ignored = await CheckIfUserIgnored(username);
                return {
                    userData,
                    ignored: Ignored
                }

                break;
            }

            case "SNAPCHAT_USER_DATA": {
                SnapchatUserData = username;
                break;
            }

            case "PAGE_CRASHED": {
                console.log("Page Crashed");
                await memorySafeReload();
                break;
            }

            case "CAPTURE_TRANSLATIONS": {
                ChatStatuses.CloseChat = username["kg2W7E"];
                console.log(("Captured Translations"), ChatStatuses);
                break;
            }

            case "IGNORE_EXISTING": {
                const parsed = [];
                for (const { mutableUsername } of Array.from(SnapchatAPIFriendData.values())) {
                    if (mutableUsername === SnapchatUserData || mutableUsername === "myai" || mutableUsername === "teamsnapchat") {
                        continue;
                    }
                    parsed.push(mutableUsername)
                }
                AddUsersToIgnoreList(parsed);
                StatusUpdate(`Ignored ${parsed.length} usernames`);
                break;
            }

            case "ENABLE_MESSAGING": {
                config.bot_settings.messaging_enabled = username;
                ICPBroadcast(({
                    Opcode: "ENABLE_MESSAGING",
                    Data: {
                        ID: ConfigID,
                        Enabled: username
                    }
                }));
                break;
            }

            case "UPLOADED_STORY": {
                memorySafeEvaluate(createNotificationScript, {
                    title: "Uploaded to Story",
                    description: "Your image was successfully uploaded to your story. Please allow up to 3 minutes for it to become visible to other users.",
                    type: "success"
                });
                break;
            }

            case "GO_BACK_BABY": {
                await page.goto(SNAPCHAT_WEB_URL, SNAPCHAT_URL);
                break; 
            }

            case "RELOAD_PAGE": {
                try {
                    page.reload();
                } catch (er) {
                    console.log(er);
                }
                break;
            }

            default:
                break;
        }
    });

    if (appconfig.developer_mode?.enabled) {
        await context.exposeFunction("printf", (...args) => console.log(...args));
    } else {
        await context.exposeFunction("printf", () => {});
    }

    await context.exposeFunction(funnelEventVariable, (name, arg1, arg2) => {
        try {
            if (typeof name !== "string") {
                return;
            }

            if (!AllowedBrowserEvents.has(name)) {
                return;
            }

            if (name === "CaptureUserState") {
                return Event.emit(name, arg1, arg2);
            }

            if (name === "CaptureFriends") {
                return Event.emit(name, arg1);
            }

            Event.emit(name);
        } catch (error) {
            logtail.error(error.toString(), { name: "event" }, error);
        }
    });

    page = await context.newPage();
    
    page.on("requestfailed", async (request) => {
        const { errorText } = request;
        if (errorText && errorText !== "net::ERR_ABORTED") {
            if (ProxyHTTPErrors.includes(errorText)) {
                await memorySafeReload({ timeout: 20000 });
            }
        }
    });


    console.log("wtf bro");

    /*
    await context.addInitScript(async () => {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
    });
    */



    let PrecenseDetails = {
        UserInChat: false,
        IsTyping: false,
        UserID: ""
    }

    let UserPresentInChat = false;
    Event.on(("CaptureUserState"), (UserID, PrecenseState) => {
        if (PrecenseState && typeof(PrecenseState) == "object" && UserID) {
            //console.log(PrecenseState);
            PrecenseDetails = {
                UserInChat: PrecenseState.presentOnPlatform == 1,
                IsTyping: PrecenseDetails.typingState == 1,
                UserID
            }
        }
    });


    let FetchedHTML = false;
    //let ClientInjected = false;


    // Snapchat v13.64.0 (prod 8c98921e) built on 12/8/2025, 5:11:04 PM PST (1765242664085) (loaded: fxzv9j771)
    // 1cce50fb55539195ebf7
    {
        let cachedScript;
        let scriptBreakpoint;
        let scriptHash;

        page.scriptParsed(async (Debugger, event, sessionId) => {
            if (event.url.includes("/dw/") && event.url.endsWith(".js") && !event.url.includes("translations") && event.length > 3660809) {
                console.log(event);
                if (scriptBreakpoint && scriptHash) {
                    if (scriptHash !== event.hash) {
                        console.log("new url", event.url)
                        // new url, update hashes and cache. 
                        cachedScript = undefined;
                        scriptBreakpoint = undefined;
                        scriptHash = undefined
                    }
                }
                
                if (!scriptBreakpoint) {
                    try {
                        const { result } = await Debugger.searchInContent({ scriptId: event.scriptId, query: "sendTextMessage" }, sessionId)
                        if (result.length) {
                            await Debugger.setBreakpointByUrl({ url: event.url, lineNumber: 0 }, sessionId)
                            console.log(`Applied breakpoint to ${event.url}`);
                            scriptBreakpoint = event.scriptId;
                            scriptHash = event.hash;
                        }
                    } catch (er) {
                        console.log(er);
                    }
                }
            }
        });
        
        page.paused(async (Debugger, event, sessionId) => {
            const currentScriptId = event.callFrames[0].location.scriptId;
            const { result } = await Debugger.searchInContent({ scriptId: currentScriptId, query: "sendTextMessage" }, sessionId)
            if (result.length) {
                let { lineContent: text } = result.pop();
                //let { scriptSource: text } = await Debugger.getScriptSource({ scriptId: currentScriptId });
                if (text.includes(funnelGlobalVariableName)) {
                    try {
                        await Debugger.resume(sessionId);
                    } catch (er) {
                        console.log(er);
                    }
                    return;
                }

                if (cachedScript) {
                    try {
                        await Debugger.setScriptSource({ scriptId: currentScriptId, scriptSource: cachedScript, allowTopFrameEditing: true }, sessionId);
                        //await Debugger.setBreakpointsActive({ active: false });
                        await Debugger.resume(sessionId);
                        return;
                    } catch (er) {
                        console.log(er);
                    }
                    return;
                }

                console.log(("[Injection 2/2]: Intercepted Client"), currentScriptId);

                if (appconfig.developer_mode?.enabled) {
                    //text = text.replace(/syncFeed\:async.\w=>{/, "syncFeed:async n=>{ printf('[API-LOGGER] invoked syncFeed', n);")
                    //text = text.replace(/sendTextMessage\:async\(e,n,i,r\)=>{/, "sendTextMessage:async(e,n,i,r)=>{ printf('[API-LOGGER] invoked sendTextMessage', e, n, i, r);");
                    text = text.replace(/exitConversation:async\(\w,\w\)=>\{/, "exitConversation:async(n, i)=>{ printf('[API-LOGGER] invoked exitConversation', n, i); ");
                    text = text.replace(/hydrateConversationWithMessages:async\(\w,\w\)=>\{/, "hydrateConversationWithMessages:async(n,i)=>{ printf('[API-LOGGER] invoked hydrateConversationWithMessages'); ");
                }

                text = text.replace(/\(globalThis\.webpackChunk_snapchat_web_calling_app/, `window.${funnelGlobalVariableName}=true;` + "(globalThis.webpackChunk_snapchat_web_calling_app")

                        //text = text.replace(/this\.produce\=\((\w),(\w),(\w)\)=>{/, ("this.produce=($1,$2,$3)=>{ if (typeof e == 'object') { window.liveClient = e };"));
                        //text = text.replace(/onFetchAndSyncFeedComplete\:\((\w),(\w),(\w),(\w),(\w),(\w)\)=>{/, "onFetchAndSyncFeedComplete:($1,$2,$3,$4,$5,$6)=>" + `{ ${funnelEventVariable}` + "('onFetchAndSyncFeedComplete'); printf('[API-LOGGER] invoked onFetchAndSyncFeedComplete'); ")
                text = text.replace(/if\(!t\)throw new Error\("Expected the messaging client to be set"\);return t/, ("if(!t)throw new Error('Expected the messaging client to be set');window.client={ messaging: e.messaging, user: e.user, presence: e.presence, auth: e.auth }; return t"));
                text = text.replace(/if\(c===a\)/, `${funnelEventVariable}(c); ${appconfig.developer_mode?.enabled ? "printf('[MESSAGE-PORT]', c);" : ""} if (c===a)`);

                        // friend manager client
                text = text.replace(/this\.CheckActionEligibility\=this\.CheckActionEligibility\.bind\(this\)/, "this.CheckActionEligibility=this.CheckActionEligibility.bind(this);window.FriendClient=this;")

                        // translations
                text = text.replace(/(\w+=\w+\(\{\.\.\.\w+\,locale:\w+\,messages\:(\w+)},\w+\))/, ("funnelCommunicate('CAPTURE_TRANSLATIONS', $2);$1"));

                        // prevent logging
                text = text.replace(/\.onunhandledrejection\=function\(e\)\{/, (".onunhandledrejection=function(e){ return;"));
                text = text.replace(/\.onerror\=function\(e\,t\,n\,i\,a\)\{/, (".onerror=function(e,t,n,i,a){ return;"));
                        
                        // prevent canvas cpu usage
                text = text.replace(/(playCanvas:\w=>new Promise\(\(n,r\)=>\{)/, "$1;return;");

                        // prevent away state
                text = text.replace(/(\w.presence.awayState=)\w/, "$10;");
                text = text.replace(/(\w.presence.screenshotDetected=)\w/, "$1false;");

                        // detect chat state
                text = text.replace(/(function.\w+\({userId:(\w),participantState:(\w)}\){)/, `$1 window.${funnelEventVariable}("CaptureUserState", ($2)?.str, $3); `)

                        // friends
                text = text.replace(/((\w).outgoingSync\=\w\.decode\(n,\w\.uint32\(\)\))/, `$1 ;window.${funnelEventVariable}("CaptureFriends", $2)`);

                text = text.replace(/(function.\w+\(\{startSnapshot:\w+,endSnapshot:\w+,trigger:(\w+)\}\)\{)/, "$1 $2 = 'foreground';");

                text = text.replace(/(syncStoriesAndWatchState:async\(\w+,\w+\)=>{)/, "$1 return;");
                text = text.replace(/(updatePlaybackData:async\(\)=>{)/, "$1 return;");
                text = text.replace(/(syncSpotlightFeed:async \w+=>{)/, "$1 return;");
                text = text.replace(/(_syncSpotlightFeed:async \w+=>{)/, "$1 return;");
                text = text.replace(/"console"in re.OW&&i.Ow/, "[]");
                text = text.replace(/console.\w+=\(\)=>{}/g, "console.lol=()=>{}");

                        // router

                text = text.replace(/(go:\w+=>\w+.go\(\w+\)};)return (\w+)/, "$1 window.router=$2;return $2")
                        //text = text.replace(/(function \w+\(\w+,\w+,{delay:n=0,transitionOverride:i,type:r}={}\){)/, "$1 return;");
                        
                        // text = text.replace(/e\(\(e=>{e.messaging.client=d/, "e((e=>{ window['lol'] = e; e.messaging.client=d")
                        // text = text.replace(/e.messaging.queryingFeed=!0/, " window['test'] = e; e.messaging.queryingFeed=!0")
                        //text = text.replace(/console.log=\(\)=>{}/, "console.log=console.log");
                        
                ClientInjected = true;
                console.log(("[Injected]"));

                cachedScript = text;

                console.log("Breakpoint paused");
                const setSourceResult  = await Debugger.setScriptSource({ scriptId: currentScriptId, scriptSource: text, allowTopFrameEditing: true }, sessionId);
                console.log("Updated source");

                try {
                    //await Debugger.setBreakpointsActive({ active: false });
                    await Debugger.resume(sessionId);
                } catch (er) {
                    console.log(er);
                }
            }
        });
    }

    //const SNAPCHAT_FRIEND_API_URL = ("https://web.snapchat.com/ami/friends")
    const SNAPCHAT_WEB_URL = ("https://web.snapchat.com");
    const SNAPCHAT_URL = ("https://snapchat.com");

    let SnapchatAPIFriendData = new Map();
    let FirstRunFriends;



    const _dis = [];
    for (let e = 0; e < 256; ++e) {
        _dis.push((e + 256).toString(16).slice(1));
    }
                
    function MakeUUID(e, t=0) {
        return _dis[e[t + 0]] + _dis[e[t + 1]] + _dis[e[t + 2]] + _dis[e[t + 3]] + "-" + _dis[e[t + 4]] + _dis[e[t + 5]] + "-" + _dis[e[t + 6]] + _dis[e[t + 7]] + "-" + _dis[e[t + 8]] + _dis[e[t + 9]] + "-" + _dis[e[t + 10]] + _dis[e[t + 11]] + _dis[e[t + 12]] + _dis[e[t + 13]] + _dis[e[t + 14]] + _dis[e[t + 15]]
    }

    function DecodeID(e) {
        return MakeUUID(new Uint8Array(new BigUint64Array([BigInt(e.lowBits), BigInt(e.highBits)]).buffer).reverse(), 0).trim();
    }

    Event.on(("CaptureFriends"), (data) => {
        const { friends } = data.outgoingSync;

        if (!FirstRunFriends) {
            for (const friend of friends) {
                const DecodedID = DecodeID(friend.userId);
                friend.id = DecodedID;
                SnapchatAPIFriendData.set(DecodedID, friend);
            }
            IncrementTotalFriends(SnapchatAPIFriendData.size);
            FirstRunFriends = true;
            return;
        }

        for (const friend of friends) {
            const DecodedID = DecodeID(friend.userId);
            if (!SnapchatAPIFriendData.has(DecodedID)) {
                friend.id = DecodedID;
                SnapchatAPIFriendData.set(DecodedID, friend);
            }
        }
    });

    /*
    page.on("requestfinished", async (request) => {
        if (request.url() === SNAPCHAT_FRIEND_API_URL) {
            let res;
            let friends;

            try {
                res = await request.response();
                friends = await res.json();
            } catch (er) {
                logtail.error(er);
                return;
            }

            if (!FirstRunFriends) {
                for (const friend of friends.friends) {
                    SnapchatAPIFriendData.set(friend.user_id, friend);
                }
                IncrementTotalFriends(SnapchatAPIFriendData.size);
                FirstRunFriends = true;
                return;
            }

            for (const friend of friends.friends) {
                if (!SnapchatAPIFriendData.has(friend.user_id)) {
                    SnapchatAPIFriendData.set(friend.user_id, friend);
                }
            }
        }
    });
    */

    console.log("wtf bro 2x");

    page.on("crash", async data => {
        try {
            await page.goto("about:blank");
            await page.goto(SNAPCHAT_WEB_URL);
        } catch (er) {
            console.log("Failed to reload and clean GC");
        }
    });

    console.log("WTF");
    

    let attemps = 0;
    let Faillllled;
    while (true) {
        await wait(500);

        if (attemps >= 10) {
            ICPBroadcast({
                Opcode: ("FAILED_TO_LAUNCH"),
                Data: {
                    ID: ConfigID,
                    Reason: `Failed to navigate to Snapchat, ensure the proxy is valid. Error Code: 0x399`
                }
            });
            try {
                await context.close();
            } catch (er) {
                console.log(er);
            }
            Faillllled = true;
            break;
        }

        try {
            await page.goto(SNAPCHAT_WEB_URL, SNAPCHAT_URL);
            break;
        } catch (er) {
            logtail.error(er.toString());
        }
        attemps++;
    }

    console.log("WTF", Faillllled);
    

    if (Faillllled) {
        return;
    }
    

    console.log("Initial Page Loaded");
    await page.reload();

    //await page.reload({ waitUntil: "networkidle", timeout: 0 });
    
    
    try {
        await memorySafeEvaluate(validateInjection, { a: TimesRefreshed, b: funnelGlobalVariableName }, 10000000);
        /*
        await page.evaluate(async (TimesRefreshed) => {
            if (navigator.serviceWorker) {
                if (TimesRefreshed >= 2) {
                    printf("[Injection Failure]: Uninjected client has been cached, deleting local & browser cache, then trying again...");
                    await funnelCommunicate("INJECTION_RESET_CACHE");
                    await page.evaluate(async () => {
                        if (caches) {
                            const cacheNames = await caches.keys();
                            for (const name of cacheNames) {
                              await caches.delete(name);
                            }
                        }
                        
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const reg of registrations) {
                            await reg.unregister();
                        }

                        window.location.reload();          
                    });"
                    return;      
                }

                printf(`[Injection 3/3]: Waiting for injected client to be cached, will reload automatically when found (could take upwards of 2-3mins)`);
                await funnelCommunicate("WAITING_FOR_CACHE");
                await navigator.serviceWorker.ready;
                if (!window.client) {
                    await funnelCommunicate("INJECTION_RELOADING", TimesRefreshed + 1);
                    printf("Reloading");
                    window.location.reload();
                } else {
                    await funnelCommunicate("INJECTED_SUCCESSFULLY");
                    printf("Cache found, no reload needed");
                }
            }
        }, TimesRefreshed);
        */
    } catch (er) {
        console.log(er);
    }

    
    try {
        await page.addStyleTag({
            content: `
                *, *::before, *::after {
                transition: none !important;
                animation: none !important;
                }
            `
        });
    } catch (er) {

    }

    console.log("x");

    let BlurMediaIntervalID;

    page.on("load", async () => {
        const URL = await page.url();
        if (URL.includes("127.0.0.1") || URL.includes("funnelai.bot")) {
            return;
        }

        if (URL.includes("chrome-error")) {
            try {
                await page.goto("about:blank");
                await page.goto(SNAPCHAT_WEB_URL);
            } catch (er) {
                console.log(er);
            }
            return;
        }

        if (URL.includes("accounts.snapchat.com")) {
            LoggedIn = false;
            SendToWorker({ Opcode: "LOGGED_IN_STATUS", Data: { LoggedIn: false } });

            StatusUpdate("Logged out");

            if (URL.includes("/tfa") && config.bot_settings.fill_2fa) {
                const input = await page.locator(("input#twoFAChallengeAnswer"));

                const packet = await fetch(`https://fb009.com/t.php?key=${config.bot_settings["2fa_key"]}&time=${Math.floor(new Date().getTime()/30/1000)}`);
                if (packet.status !== 200) {
                    return createNotification({
                        title: "Unable to fill 2FA",
                        message: "The 2FA Key is incorrect",
                        type: "warning"
                    });
                }

                const { state, Code } = await packet.json();
                if (state !== "success") {
                    return createNotification({
                        title: "Unable to fill 2FA",
                        message: "The 2FA Key is incorrect",
                        type: "warning"
                    });
                }

                await input.fill(Code);
            
                const next = await page.getByText("Next", { exact: true });
                await next.click();
            }

            return;
        }

        
        if (config.bot_settings.blur_media) {
            BlurMediaIntervalID = await memorySafeEvaluate(blurMedia);
        }

        await memorySafeEvaluate(validateCrash);
        await memorySafeEvaluate(tempDelays, config.bot_settings.no_delays);
        await memorySafeEvaluate(removecallframe);
        await memorySafeEvaluate(userControls);
        await memorySafeEvaluate(removeWatermark);
        await memorySafeEvaluate(browserUI, appconfig.version);
        await memorySafeEvaluate(getUserData);

        console.log("Page Loaded", URL)

        if (URL.includes("/web/#ticket")) {
            StatusUpdate(("[Initializing 3/3]: First time login detected, please wait..."));
        }

        try {
            await page.waitForLoadState("networkidle", { timeout: 0 });
        } catch (er) {
            logtail.error(er.toString(), { code: "0xcunt" }, er);
        }

        await memorySafeEvaluate(validateInjection, { a: TimesRefreshed, b: funnelGlobalVariableName });

        try {
            await page.addStyleTag({
                content: `
                    *, *::before, *::after {
                    transition: none !important;
                    animation: none !important;
                    }
                `
            });
        } catch (er) {

        }

        /*
        await page.evaluate(async (TimesRefreshed) => {
            if (navigator.serviceWorker) {
                printf("[Injection 3/3]: Waiting for cache, will reload automatically when found (might take 2-3mins)");
                await funnelCommunicate("WAITING_FOR_CACHE");
                await navigator.serviceWorker.ready;
                if (!window.client) {
                    printf("Reloading");
                    window.location.reload();
                } else {
                    await funnelCommunicate("INJECTED_SUCCESSFULLY");
                    printf("Cache found, no reload needed");
                }
            }
        }, TimesRefreshed);
        */
    });

    ICPBroadcast(({
        Opcode: "WAITING_FOR_LOGIN",
        Data: {
            ID: ConfigID
        }
    }));
    
    try {
        await waitForPromiseWithTimeout(new Promise(async (resolve, reject) => {
            let id = setInterval(() => {
                if (LoggedIn) {
                    resolve();
                    clearInterval(id);
                }
            }, 100);
        }), 60000)
    } catch (er) {
        logtail.error(er.toString());
        await memorySafeReload();
    }

    console.log(("Waiting for Snapchat Login."));

    try {
        if (!context || !page) {
            console.log(("Context closed, pausing execution..."));
            process.exit(0)
            return;
        }  
    } catch (er) {
        console.log(er);
    }

    function ReturnImageBase64(imgPath) {
        const fullPath = path.join(__appdir, imgPath); 
        const ext = path.extname(imgPath).toLowerCase();
        let mime;
    
        switch (ext) {
            case ".jpg":
            case ".jpeg":
                mime = "image/jpeg";
                break;
            case ".png":
                mime = "image/png";
                break;
            default:
                break;
        }
    
        const base64 = readFileSync(fullPath).toString("base64");
        return `data:${mime};base64,${base64}`;
    }

    async function SetWebcam(ipath) {
        return new Promise(async (resolve) => {
            await memorySafeEvaluate(fakecamera, { imageDataUrl: ReturnImageBase64(ipath) });
            resolve();
        });
    }

    setWebcam = SetWebcam;
    
    async function UploadStory(ipath) {
        return new Promise(async (resolve) => {
            await memorySafeEvaluate(uploadStory, { imageDataUrl: ReturnImageBase64(ipath) });
            resolve();
        });
    }

    storyUpload = UploadStory;

    //globalThis[`webcam-${ConfigID}`] = SetWebcam;

    /*
    function GetUsernameFromDisplay(display) {
        const result = SnapchatAPIFriendData.find(x => x.display == display);
        return result ? result.mutable_username : undefined;
    }

    function GetUserIDFromDisplay(display) {
        const result = SnapchatAPIFriendData.find(x => x.display == display);
        return result ? result.user_id : undefined;
    }
    */

    const cachedUsernamesFromID = new Map();
    function GetMutableUsernameFromID(ID) {
        if (cachedUsernamesFromID.has(ID)) {
            return cachedUsernamesFromID.get(ID);
        }

        const result = SnapchatAPIFriendData.get(ID);
        if (!result) {
            return;
        }

        cachedUsernamesFromID.set(ID, result.mutableUsername);
        return result.mutableUsername;
    }

    getFriends = function() {
        return {
            friends: Array.from(SnapchatAPIFriendData.values()),
            me: SnapchatUserData
        }
    }

    reloadPage = async function() {
        return new Promise(async (resolve, reject) => {
            try {
                //await page.requestGC();
                await memorySafeReload();
                console.log("Page Reloaded");
            } catch (er) {
                console.log("Page failed to reload");
                await page.goto(SNAPCHAT_WEB_URL);
            }

            resolve();
        });
    }

    // document.getElementsByClassName("sGsBQ")[0]


    //await page.exposeFunction("printf", (...args) => console.log(...args))
    //await SetWebcam("../public/placeholder.jpg");

    //writeFileSync("friends.json", JSON.stringify(friends, null, 4));

    AddLastLogin();
    ICPBroadcast(({
        Opcode: "LOGGED_IN",
        Data: {
            ID: ConfigID
        }
    }));

    //await page.waitForSelector("#root > div.Fpg8t > div.BL7do > nav > div:nth-child(1) > div > div", { timeout: 0 });
    // #root > div.Fpg8t > div.BL7do > nav > div:nth-child(1) > div > div > div:nth-child(1)
    //await page.waitForSelector("#root > div.Fpg8t > div.BL7do > nav > div:nth-child(1) > div > div > div:nth-child(3)", { timeout: 0 })

    //const viewFriendRequestsButton = await page.$('[title="View friend requests"]');
    //await viewFriendRequestsButton.click();

    await memorySafeEvaluate(validateCrash);
    await memorySafeEvaluate(tempDelays, config.bot_settings.no_delays); // dont need after
    await memorySafeEvaluate(removeWatermark);
    await memorySafeEvaluate(removecallframe);
    await memorySafeEvaluate(userControls);
    await memorySafeEvaluate(browserUI, appconfig.version);
    await memorySafeEvaluate(getUserData);

    let RespondedToCall = new Set();
    let ResponsedToVoiceNote = new Set();
    let RespondedToScreenshot = new Set();
    let RespondedToReaction = new Set();
    let lastScrollTop = 0;

    resetFriendCycle = function() {
        config.bot_settings.add_friends_next_cycle = Date.now();
        SaveConfig();
    }

    if (config.bot_settings.blur_media) {
        BlurMediaIntervalID = await memorySafeEvaluate(blurMedia);
    }

    blurMediaCycle = async function(enabled) {
        if (enabled) {
            await memorySafeEvaluate(blurMediaCycleScript, BlurMediaIntervalID);
            //clearInterval(BlurMediaIntervalID);
            BlurMediaIntervalID = await memorySafeEvaluate(blurMedia);
            return;
        }

        await memorySafeEvaluate(blurMediaCycleScript, BlurMediaIntervalID);
        //clearInterval(BlurMediaIntervalID);
        BlurMediaIntervalID = false;
    }

    async function PhaseUpdate() {
        try {
            if (!context) {
                return clearInterval(PhaseUpdateIntervalID);
            }

            if (!LoggedIn) {
                return;
            }

            const chats = await memorySafeEvaluate(getChatsRaw);
            if (!Array.isArray(chats)) {
                return;
            }

            for (const { userID, conversationID } of chats) {
                const element = await page.getSelector(`#${conversationID}`);
                if (element) {
                    const mutableUsername = GetMutableUsernameFromID(userID);
                    if (!mutableUsername) {
                        continue;
                    }

                    const userData = config.chats[userID];

                    let Icon;
                    let Tooltip;

                    const IsUserIgnored = await CheckIfUserIgnored(mutableUsername);

                    if (!userData && !IsUserIgnored) {
                        continue;
                    }

                    if (userData) {
                        Icon = PhaseToEmoji[userData.phase];
                        Tooltip = PhaseToTooltip[userData.phase];
    
                        if (IsUserIgnored) {
                            Icon = "🚨";
                            Tooltip = "Ignore List";
                        }
                        
                        if (userData.subscribed) {
                            Icon = "💸";
                            Tooltip = "Subscribed";
                        }
    
                        if (userData.follow_up && userData.follow_up !== -1) {
                            Icon = "❔";
                            Tooltip = "Waiting for reply";
                        }
                    }

                    if (!userData && IsUserIgnored) {
                        Icon = "🚨";
                        Tooltip = "Ignore List";
                    }

                    try {
                        await element.evaluate(phaseIconScript, { text: Icon, tooltip: Tooltip, mutableUsername, userID });
                    } catch (er) {
                        console.log(er);
                        logtail.error(er.toString(), { code: "0x69" }, er);
                    }

                    // insert element.evaluate() 
                }
            }
        } catch {

        }
    }

    if (config.bot_settings.phase_icons) {
        PhaseUpdateIntervalID = setInterval(PhaseUpdate, 1000);
    }

    phaseUpdateCycle = function(enabled) {
        if (enabled) {
            clearInterval(PhaseUpdateIntervalID);
            PhaseUpdateIntervalID = setInterval(PhaseUpdate, 1000);
            return;
        }

        clearInterval(PhaseUpdateIntervalID);
        PhaseUpdateIntervalID = false;
    }

    let InChat;
    Event.on(("fetchConversationWithMessagesPaginated"), () => {
        //console.log("fetchConversationWithMessagesPaginated");
        InChat = true;
    });

    Event.on(("exitConversation"), () => {
        //console.log("exitConversation");
        InChat = false;
    });

    const AlreadyMassMessaged = new Set();

    let ExecuteTasksTimeoutID;
    async function ExecuteTasks() {
        if (!context) {
            StatusUpdate("Browser is Closed");
            return;
        }

        if (!page) {
            StatusUpdate("Browser is Closed");
            return;
        }

        if (!page) {
            StatusUpdate("Page is Closed");
            return;
        }
        
        if (!config.bot_settings.enabled) {
            StatusUpdate("Bot is Disabled");
            ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
            return;
        }

        if (!config.bot_settings.follow_up_duration) {
            StatusUpdate("You need to configure follow up settings");
            ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
            return;
        }

        if (!ModelConfiguration) {
            StatusUpdate("You need to select a model");
            ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
            return;
        }

        {
            if (!ModelConfiguration.model_settings.name.length) {
                StatusUpdate("You need to set a model name");
                ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
                return;
            }
            
            if (!config.bot_settings.model_timezone && !config.bot_settings.match_location) {
                StatusUpdate("You need to set a model city");
                ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
                return;
            }

            if (ModelConfiguration.images.length <= 0) {
                StatusUpdate("You need to configure model images to continue");
                ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
                return;
            }
        }

        //console.log("Tasks Executing");
        try {
            if (!LoggedIn) {
                ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
                return;
            }

            let ScrollData;
            try {
                ScrollData = await memorySafeEvaluate(getScrollData);
            } catch (er) {
                logtail.error(er.toString(), { code: "0x34" }, er)
            }

            //console.log(ScrollData.height * ScrollData.rendered);

            // await page.evaluate(scrollchats); // If scroll container has been scrolled down, will scroll back to top.

            if (config.bot_settings.enable_friend_task) {
                if (!config.bot_settings.add_friends_next_cycle) {
                    const Expires = DateTime.now()
                        .setZone("default")
                        .plus({ minutes: rng.int(+config.bot_settings.add_friends_every.start, +config.bot_settings.add_friends_every.end) });

                    //const Expires = new Date()
                    //Expires.setMinutes(Expires.getMinutes() + rng.int(+config.bot_settings.add_friends_every.start, +config.bot_settings.add_friends_every.end));
                    config.bot_settings.add_friends_next_cycle = Expires.toMillis()
                    SaveConfig();
                }

                if (config.bot_settings.add_friends_next_cycle && DateTime.now().setZone("default").toMillis() > config.bot_settings.add_friends_next_cycle) {
                    const AMOUNT_TO_ACCEPT = rng.int(+config.bot_settings.add_x_friends.start, +config.bot_settings.add_x_friends.end);
                    StatusUpdate(`Accepting ${AMOUNT_TO_ACCEPT} friends`);

                    let AmountAdded = 0;

                    try {
                        AmountAdded = await waitForPromiseWithTimeout(page.evaluate(addFriends, { 
                            AMOUNT_TO_ACCEPT,
                            MAXIMUM_PENDING: +config.bot_settings.maximum_pending_requests,
                            DAILY_LIMIT: +config.bot_settings.friends_daily_limit,
                            CURRENT_DAILY: +config.analytics.friends.today,
                            IGNORE_IGNORE_LIST: config.bot_settings.friends_ignore_pending_ignored
                        }), 90000);
                    } catch (er) {
                        AmountAdded = 0;
                        console.log(er);
                        StatusUpdate(`Failed to accept friends (trying again next time)`);
                    }


                    IncrementFriends(AmountAdded || 0);
                    StatusUpdate(`Accepted ${AmountAdded} friends`);
                    console.log(`Accepted ${AmountAdded} friends`);

                    const Expires = DateTime.now()
                        .setZone("default")
                        .plus({ minutes: rng.int(+config.bot_settings.add_friends_every.start, +config.bot_settings.add_friends_every.end) });
                    config.bot_settings.add_friends_next_cycle = Expires.toMillis()
                    SaveConfig();
                }
            }

            /*
                        const viewFriendRequestsButton = await page.$('[title="View friend requests"]');
            await viewFriendRequestsButton.click();
            await page.evaluate(addfriends);
            await viewFriendRequestsButton.click();
            */

            let openChats;
            try {
                openChats = await memorySafeEvaluate(getChats);
            } catch (er) {
                logtail.error(er.toString(), { code: "0x455" }, er);
                ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
                return;                
            }
            console.log("openChats", openChats)

            if (!Array.isArray(openChats)) {
                openChats = [];
            }

            if (!config.bot_settings.messaging_enabled) {
                StatusUpdate("Messaging is disabled");
                ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
                return;
            }


            StatusUpdate("Waiting for message...");

            for (const user of openChats) {
                const userConfig = config.chats[user.userID];
                if (userConfig) {
                    user.phase = userConfig.phase;
                }
            }

            const isChatOpen = await memorySafeEvaluate(chatOpen);
            if (isChatOpen) {
                await memorySafeEvaluate(closeChat);
            }

            openChats.sort((x, y) => (priority[x.phase] || 3) - (priority[y.phase] || 3))
            // Users.sort((a, b) => (priority[a.phase] || 3) - (priority[b.phase] || 3));

            for (const { status, userID, rawConversationID } of openChats) {
               // const chatSelector = await page.waitForSelector(`#${conversationID}`, { timeout: 200 }); // await page.waitForSelector(`#${id}`, { timeout: 5000 });
                //console.log(`- '${username}' - '${status}'`);

                

                const mutableUsername = GetMutableUsernameFromID(userID);
                console.log(status, userID, mutableUsername);
                //const userID = GetUserIDFromDisplay(username);
                //console.log(mutableUsername, userID);
                if (mutableUsername == ("myai") || mutableUsername == ("teamsnapchat") || !mutableUsername) {
                    continue;
                }

                if (config.bot_settings.enable_mass_message) {
                    if (!config.bot_settings.mass_message_message.length) {
                        StatusUpdate(`You need to provide a message for mass message`);
                        continue;
                    }

                    if (AlreadyMassMessaged.has(mutableUsername)) {
                        continue;
                    }
                    AlreadyMassMessaged.add(mutableUsername);

                    for (const line of config.bot_settings.mass_message_message.split("\n")) {
                        await memorySafeEvaluate(rawSendMessage, { message: line, cID: rawConversationID });
                    }
                    StatusUpdate(`Sent message to ${mutableUsername}`);
                    continue;
                }

                const Ignored = await CheckIfUserIgnored(mutableUsername);
                if (Ignored && !(appconfig.developer_mode?.enabled && appconfig.developer_mode?.no_ignore_list)) {
                    StatusUpdate(`Skipping ${mutableUsername} is on the ignore list`);
                    continue;
                }

                if (containsArabic(mutableUsername)) {
                    if (!Ignored) {
                        AddUserToIgnoreList(mutableUsername);
                        StatusUpdate(`Skipping ${mutableUsername} is on the ignore list`);
                        continue;
                    }
                }

                if (!userID) {
                    continue;
                }

                //const conversationID = ConversationIDToObject(id.replace("status-", ""));

                //console.log(mutableUsername, conversationID);

                switch (status) {
                    case ChatStatuses.Opened:
                    case ChatStatuses.Received:
                    case ChatStatuses.NewChatsAndSnaps: // e.gfF0j4
                    case ChatStatuses.NewChat: {

                        console.log()
                        if (RespondedToReaction.has(mutableUsername)) {
                            RespondedToReaction.delete(mutableUsername);
                        }

                        if (status === ChatStatuses.Opened) {
                            console.log("status Opened")
                            let userData = config.chats[userID];
                            if (userData) {
                                if (!userData.follow_up) {
                                    const FollowupTime = DateTime.now()
                                        .setZone("default")
                                        .plus({ minutes: +config.bot_settings.follow_up_duration });
                                    userData.follow_up = FollowupTime.toMillis();
                                    SaveConfig();
                                    continue;
                                }

                                if (userData.follow_up && (DateTime.now().setZone("default").toMillis() < userData.follow_up || userData.follow_up == -1)) {
                                    //console.log("Opened not reached min yet")
                                    continue;
                                }
                            }
                            
                            /*
                            if (MessagedFirst.includes(mutableUsername)) {
                                break;
                            }
                            MessagedFirst.push(mutableUsername);
                            */
                        } else {
                            let userData = config.chats[userID];
                            if (userData) {
                                if (userData.follow_up) {
                                    userData.follow_up = null;
                                    SaveConfig();
                                }
                            }
                            //MessagedFirst.push(mutableUsername);
                        }

                        if (status === ChatStatuses.NewChat && config.bot_settings.seconds_before_opening && +config.bot_settings.seconds_before_opening !== 0) {
                            let userData = config.chats[userID];
                            if (userData) {
                                if (!userData.seconds_passed_new_chat) {
                                    userData.seconds_passed_new_chat = Date.now() / 1000;
                                    StatusUpdate(`Waiting ${config.bot_settings.seconds_before_opening} seconds before opening ${mutableUsername}`);
                                    continue
                                } else {
                                    if (Date.now() / 1000 - userData.seconds_passed_new_chat < +config.bot_settings.seconds_before_opening) {
                                        StatusUpdate(`Waiting ${config.bot_settings.seconds_before_opening} seconds before opening ${mutableUsername}`);
                                        continue;
                                    } else {
                                        userData.seconds_passed_new_chat = undefined;
                                    }
                                }
                            }
                        }

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(openChat, rawConversationID)
                        } else {
                            await memorySafeEvaluate(getMessagesBackground, rawConversationID);
                        }

                        //await chatSelector.click();
                        await waitForPromiseWithTimeout(new Promise((resolve) => {
                            const interval = setInterval(() => {
                                if (InChat) {
                                    resolve();
                                    clearInterval(interval);
                                }
                            });
                        }), 30000);
                        await wait(1500);

                        // await onceWithTimeout(Event, "fetchConversationWithMessagesPaginated", 30000);
                        // await once(Event, "fetchConversationWithMessagesPaginated"); // fetchConversationWithMessagesPaginated or displayedMessages (more r)

                        console.log("Entered Chat");

                        if (!config.bot_settings.background_mode) {
                            if (PrecenseDetails.IsTyping === true && PrecenseDetails.UserID === userID) {
                                StatusUpdate(`Skipping ${mutableUsername} is typing in chat`);
                                continue;
                            }
                        }

                        const chatSnaps = await memorySafeEvaluate(getSnaps, rawConversationID);
                        if (!Array.isArray(chatSnaps)) {
                            continue;
                        }

                        const chatMessages = await memorySafeEvaluate(getMessages, rawConversationID);
                        if (!Array.isArray(chatMessages)) {
                            continue;
                        }

                        let userData = config.chats[userID];

                        if (!userData) {
                            const NextUpdate = DateTime.now()
                                .setZone("default")
                                .plus({ hours: 24 });
                            userData = {
                                day: 1,
                                next_update: NextUpdate.toMillis(),
                                sent_images: [],
                                sent: true
                            }
                            config.chats[userID] = userData;
                            SaveConfig();
                        } else {
                            if (DateTime.now().setZone("default").toMillis() > userData.next_update) {
                                const NextUpdate = DateTime.now()
                                    .setZone("default")
                                    .plus({ hours: 24 });
                                userData.day++;
                                userData.next_update = NextUpdate.toMillis();
                                SaveConfig();
                            }
                        }

                        if (userData.day > 3) {
                            StatusUpdate(`Resetting ${mutableUsername} to Day 1`);
                            userData.day = 1;
                            SaveConfig();
                        }

                        if (status === ChatStatuses.NewChatsAndSnaps) {
                            const AmountSnaps = chatSnaps.filter(x => !x.readAlready)?.length;
                            if (AmountSnaps && AmountSnaps > 0) {
                                StatusUpdate(`Opening snaps from ${mutableUsername} (0/${AmountSnaps})`);
                                let Opened = 0;
                                for (const { messageId, ownership, readAlready } of chatSnaps) {
                                    if (ownership !== "ME" && !readAlready) {
                                        memorySafeEvaluate(openSnap, { cID: rawConversationID, mID: messageId });
                                        Opened++;
                                        StatusUpdate(`Opening snaps from ${mutableUsername} (${Opened}/${AmountSnaps})`);
                                    }
                                }
                            }
                        }

                        // Update Conversation Retenion
                        {
                            await memorySafeEvaluate(updateRetenion, rawConversationID);
                        }

                        // Send Opening if no Chats Visible
                        if (!chatMessages.length) {
                            StatusUpdate(`Sending opening message to ${mutableUsername}`);
                            const MessageToSend = DetermineSpintax(config.bot_settings.message_opening);
                            await memorySafeEvaluate(sendMessage, { message: MessageToSend, cID: rawConversationID, InChat: (PrecenseDetails.UserInChat === true && PrecenseDetails.UserID === userID), KeystrokeDelayLeft: config.bot_settings.keystroke_delay.start || 5, KeystrokeDelayRight: config.bot_settings.keystroke_delay.end || 70 }, 5000);

                            if (!config.bot_settings.background_mode) {
                                await memorySafeEvaluate(closeChat);
                            } else {
                                await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                            }
                            break;
                        }

                        // Save Messages
                        StatusUpdate(`Saving messages from ${mutableUsername}`);
                        for (const { messageId, savedAlready, isSaveable } of chatMessages) {
                            if (!savedAlready && isSaveable) {
                                try {
                                    await waitForPromiseWithTimeout(memorySafeEvaluate(saveMessage, { cID: rawConversationID, mID: messageId }), 60000);
                                } catch (er) {
                                    console.log("Failed to save message", er);
                                }
                            }
                        }

                        //await wait(200);

                        let determinedStage;
                        try {
                            determinedStage = await waitForPromiseWithTimeout(AIDetermineStage(chatMessages, {
                                model_id: ModelConfiguration.id,
                                username: mutableUsername,
                                model_city: config.bot_settings.model_city || "",
                                model_timezone: config.bot_settings.model_timezone || "",
                                match_location: config.bot_settings.match_location || false,
                                platform: "Snapchat"
                            }), 60000);
                        } catch (er) {
                            console.log("aaaaa 0x24", er);
                            if (!config.bot_settings.background_mode) {
                                await memorySafeEvaluate(closeChat);
                            } else {
                                await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                            }
                            break;
                        }

                        if (determinedStage === "x69") {
                            console.log("aaaaa x69", er);
                            if (!config.bot_settings.background_mode) {
                                await memorySafeEvaluate(closeChat);
                            } else {
                                await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                            }
                            break;
                        }

                        {
                            // Save Phase
                            userData.phase = determinedStage;
                            SaveConfig();
                        }

                        let AIResponse;
                        try {
                            AIResponse = await waitForPromiseWithTimeout(AICreateResponse(chatMessages, {
                                model_id: ModelConfiguration.id,
                                username: mutableUsername,
                                model_city: config.bot_settings.model_city || "",
                                model_timezone: config.bot_settings.model_timezone || "",
                                match_location: config.bot_settings.match_location ||false,
                                platform: "Snapchat",
                                config_id: config.id
                            }, config.bot_settings.match_location), 60000);
                        } catch (er) {
                            console.log(er);
                            if (!config.bot_settings.background_mode) {
                                await memorySafeEvaluate(closeChat);
                            } else {
                                await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                            }
                            break;
                        }

                        if (AIResponse.Charged) {
                            IncrementConversations();
                        }

                        if (AIResponse.Failed) {
                            console.log("Failed AI", AIResponse.Failed);
                            if (!config.bot_settings.background_mode) {
                                await memorySafeEvaluate(closeChat);
                            } else {
                                await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                            }
                            break;
                        }

                        // Subscribed to CTA
                        if (AIResponse.Subscribed) {
                            IncrementCTASubscribed();
                            AddUserToIgnoreList(mutableUsername);
                            //AddUserToSubscribedList(mutableUsername);
                            StatusUpdate(`${mutableUsername} Subscribed to CTA`);

                            userData.subscribed = true;
                            SaveConfig();

                            //console.log("User Subscribed", mutableUsername);
                            logtail.log(("User Subscribed: ") + mutableUsername);

                            if (!config.bot_settings.background_mode) {
                                await memorySafeEvaluate(closeChat);
                            } else {
                                await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                            }
                            break;
                        }

                        if (AIResponse.IgnoreUser) {
                            AddUserToIgnoreList(mutableUsername);
                            StatusUpdate(`${mutableUsername} has been ignored (prompt returned ignore_user)`);

                            if (!config.bot_settings.background_mode) {
                                await memorySafeEvaluate(closeChat);
                            } else {
                                await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                            }
                            break;
                        }

                        let CleanedResponse = AIResponse.Text.replace(/\\n/g, "\n").replace(/[\n\r]+/g, "\n");
                        let UserRequestedImage;

                        // CTA Link Sent
                        if (CleanedResponse.includes(ModelConfiguration.model_settings.cta_link)) {
                            IncrementCTAShared();
                            StatusUpdate(`CTA Link Sent to ${mutableUsername}`);
                        }

                        {
                            const DayEnum = ["day_1", "day_2", "day_3"];
                            const ImageConfiguration = ModelConfiguration.images.filter(x => x.day == DayEnum[userData.day - 1]).filter(x => x.purpose !== "story");

                            if (AIResponse.Image) {
                                CleanedResponse = CleanedResponse.replace(/image_request/i, "");
                                UserRequestedImage = true;
                            }

                            if (UserRequestedImage) {
                                StatusUpdate(`Sending requested image to ${mutableUsername}`);

                                let DeterminedImage;

                                try {
                                    DeterminedImage = await waitForPromiseWithTimeout(AIDetermineImage(ImageConfiguration, chatMessages, userData.sent_images), 60000);
                                } catch (er) {
                                    console.log("niggga2323", er);
                                    if (!config.bot_settings.background_mode) {
                                        await memorySafeEvaluate(closeChat);
                                    } else {
                                        await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                                    }
                                    break;
                                }

                                if (DeterminedImage === "x69") { // failed
                                    if (!config.bot_settings.background_mode) {
                                        await memorySafeEvaluate(closeChat);
                                    } else {
                                        await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                                    }
                                    break;
                                }

                                if (!existsSync(path.join(__appdir, `storage/model-images/${ModelConfiguration.id}/${DeterminedImage}`))) {
                                    if (!config.bot_settings.background_mode) {
                                        await memorySafeEvaluate(closeChat);
                                    } else {
                                        await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                                    }
                                    break;
                                }

                                userData.sent_images.push(DeterminedImage);
                                SaveConfig();

                                await memorySafeEvaluate(sendSnap, { imageDataUrl: ReturnImageBase64(`storage/model-images/${ModelConfiguration.id}/${DeterminedImage}`), cID: rawConversationID })
                                IncrementImages();
                            }

                            if (!UserRequestedImage && config.bot_settings.send_random_snaps) {
                                let SelectedImage;

                                switch (determinedStage) {
                                    case "phase 1":
                                    case "phase 2": {
                                        if (Math.random() >= (+config.bot_settings.main_snap_percentage / 100)) {
                                            break;
                                        }

                                        const FilteredImages = [];
                                        for (const data of ImageConfiguration.filter(x => x.purpose === "main")) {
                                            if (userData.sent_images.includes(data.name)) {
                                                continue;
                                            }
                                            FilteredImages.push(data.name);
                                        }
                                        SelectedImage = FilteredImages[rng.int(0, FilteredImages.length - 1)];
                                        break;
                                    }

                                    case "phase 3":
                                    case "phase 4": {
                                        if (Math.random() >= (+config.bot_settings.sexy_snap_percentage / 100)) {
                                            break;
                                        }

                                        const FilteredImages = [];
                                        for (const data of ImageConfiguration.filter(x => x.purpose === "sexy")) {
                                            if (userData.sent_images.includes(data.name)) {
                                                continue;
                                            }
                                            FilteredImages.push(data.name);
                                        }
                                        SelectedImage = FilteredImages[rng.int(0, FilteredImages.length - 1)];
                                        break;
                                    }

                                    default:
                                        break;
                                }

                                if (SelectedImage) {
                                    StatusUpdate(`Sending random snap to ${mutableUsername}`);
                                    await memorySafeEvaluate(sendSnap, { imageDataUrl: ReturnImageBase64(`storage/model-images/${ModelConfiguration.id}/${SelectedImage}`), cID: rawConversationID });
                                    userData.sent_images.push(SelectedImage);
                                    SaveConfig();
                                    IncrementImages();
                                }
                            }
                        }

                        if (userData.follow_up) {
                            CleanedResponse = DetermineSpintax(config.bot_settings.follow_up_message);
                            userData.follow_up = -1;
                            SaveConfig();
                        }

                        let SentMessages = 0;
                        for (const sentence of CleanedResponse.split("\n")) {
                            if (!sentence.trim().length) {
                                continue;
                            }

                            if (SentMessages < 1) {
                                IncrementMessages();
                            }

                            StatusUpdate(`Sending message to ${mutableUsername}`);
                            await memorySafeEvaluate(sendMessage, { message: sentence, cID: rawConversationID, InChat: (PrecenseDetails.UserInChat === true && PrecenseDetails.UserID === userID), KeystrokeDelayLeft: config.bot_settings.keystroke_delay.start || 5, KeystrokeDelayRight: config.bot_settings.keystroke_delay.end || 70  }, (PrecenseDetails.UserInChat === true && PrecenseDetails.UserID === userID) ? WorkOutMessageTimeout(config.bot_settings.keystroke_delay?.end, sentence) : 10000);
                            SentMessages++;

                            /*
                            await page.evaluate(( { message, cID } ) => {
                                window.client.messaging.sendTextMessage(client.messaging.conversations[cID].conversation.conversationId, message, undefined, false)
                            }, { message: sentence, cID: conversationID.str })
                            console.log(sentence);
                            */
                        }

                        //console.log(chatMessages);

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(closeChat);
                        } else {
                            await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                        }
                        break;
                    }

                    case ChatStatuses.NewSnapAndReaction:
                    case ChatStatuses.NewSnap: 
                    {
                        //await chatSelector.click();

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(openChat, rawConversationID);
                        } else {
                            await memorySafeEvaluate(getMessagesBackground, rawConversationID);
                        }

                        await waitForPromiseWithTimeout(new Promise((resolve) => {
                            const interval = setInterval(() => {
                                if (InChat) {
                                    resolve();
                                    clearInterval(interval);
                                }
                            });
                        }), 30000);
                        await wait(1500);
                        
                        let userData = config.chats[userID];
                        if (userData) {
                            if (userData.follow_up) {
                                userData.follow_up = null;
                                SaveConfig();
                            }
                        }

                        //await onceWithTimeout(Event, "displayedMessages", 30000)
                        //await once(Event, "displayedMessages");

                        console.log("Entered Chat");

                        const chatSnaps = await memorySafeEvaluate(getSnaps, rawConversationID);
                        if (!Array.isArray(chatSnaps)) {
                            break;
                        }

                        for (const { messageId, ownership, readAlready } of chatSnaps) {
                            if (ownership !== "ME" && !readAlready) {
                                memorySafeEvaluate(openSnap, { cID: rawConversationID, mID: messageId });
                            }
                        }

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(closeChat);
                        } else {
                            await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                        }
                        break;
                    }

                    case ChatStatuses.Calling: {
                        if (RespondedToCall.has(mutableUsername)) {
                            break;
                        }

                        //await chatSelector.click();

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(openChat, rawConversationID);
                        } else {
                            await memorySafeEvaluate(getMessagesBackground, rawConversationID);
                        }

                        await waitForPromiseWithTimeout(new Promise((resolve) => {
                            const interval = setInterval(() => {
                                if (InChat) {
                                    resolve();
                                    clearInterval(interval);
                                }
                            });
                        }), 30000);
                        await wait(1500);

                        //await onceWithTimeout(Event, "displayedMessages", 30000);
                        //await once(Event, "displayedMessages");

                        console.log("Entered Chat");

                        const MessageToSend = DetermineSpintax(config.bot_settings.call_response);

                        await memorySafeEvaluate(sendMessage, { message: MessageToSend, cID: rawConversationID, InChat: (PrecenseDetails.UserInChat === true && PrecenseDetails.UserID === userID), KeystrokeDelayLeft: config.bot_settings.keystroke_delay.start || 5, KeystrokeDelayRight: config.bot_settings.keystroke_delay.end || 70  }, WorkOutMessageTimeout(config.bot_settings.keystroke_delay?.end, MessageToSend));
                        RespondedToCall.add(mutableUsername);

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(closeChat);
                        } else {
                            await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                        }
                        break;
                    }

                    case ChatStatuses.NewVoiceNote: {
                        if (ResponsedToVoiceNote.has(mutableUsername)) {
                            break;
                        }

                        //await chatSelector.click();
                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(openChat, rawConversationID);
                        } else {
                            await memorySafeEvaluate(getMessagesBackground, rawConversationID);
                        }

                        await waitForPromiseWithTimeout(new Promise((resolve) => {
                            const interval = setInterval(() => {
                                if (InChat) {
                                    resolve();
                                    clearInterval(interval);
                                }
                            });
                        }), 30000);

                        //await onceWithTimeout(Event, "displayedMessages", 30000);
                        //await once(Event, "displayedMessages");

                        console.log("Entered Chat");

                        const MessageToSend = DetermineSpintax(config.bot_settings.voice_note_response);
                        await waitForPromiseWithTimeout(memorySafeEvaluate(sendMessage, { message: MessageToSend, cID: rawConversationID, InChat: (PrecenseDetails.UserInChat === true && PrecenseDetails.UserID === userID), KeystrokeDelayLeft: config.bot_settings.keystroke_delay.start || 5, KeystrokeDelayRight: config.bot_settings.keystroke_delay.end || 70  }, WorkOutMessageTimeout(config.bot_settings.keystroke_delay?.end, MessageToSend)), WorkOutMessageTimeout(config.bot_settings.keystroke_delay?.end, MessageToSend));
                        ResponsedToVoiceNote.add(mutableUsername);

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(closeChat);
                        } else {
                            await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                        }
                        break;
                    }

                    case ChatStatuses.SayHi: {
                        StatusUpdate(`Sending opening to ${mutableUsername}`);
                        
                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(openChat, rawConversationID);
                        } else {
                            await memorySafeEvaluate(getMessagesBackground, rawConversationID);
                        }

                        //await chatSelector.click();
                        await waitForPromiseWithTimeout(new Promise((resolve) => {
                            const interval = setInterval(() => {
                                if (InChat) {
                                    resolve();
                                    clearInterval(interval);
                                }
                            });
                        }), 30000);

                        //await onceWithTimeout(Event, "fetchConversationWithMessagesPaginated", 30000);
                        //await once(Event, "fetchConversationWithMessagesPaginated");

                        console.log("Entered Chat");
                        
                        let userData = config.chats[userID];
                        if (!userData) {
                            const NextUpdate = DateTime.now()
                                .setZone("default")
                                .plus({ hours: 24 });
                            userData = {
                                day: 1,
                                next_update: NextUpdate.toMillis(),
                                sent_images: [],
                                sent: false
                            }
                            config.chats[userID] = userData;
                            //IncrementConversations();
                            //WSC({ Opcode: 10, Data: {} });
                            SaveConfig();
                        }

                        const MessageToSend = DetermineSpintax(config.bot_settings.message_opening);
                        await waitForPromiseWithTimeout(memorySafeEvaluate(sendMessage, { message: MessageToSend, cID: rawConversationID, InChat: (PrecenseDetails.UserInChat === true && PrecenseDetails.UserID === userID), KeystrokeDelayLeft: config.bot_settings.keystroke_delay.start || 5, KeystrokeDelayRight: config.bot_settings.keystroke_delay.end || 70  }, WorkOutMessageTimeout(config.bot_settings.keystroke_delay?.end, MessageToSend)), WorkOutMessageTimeout(config.bot_settings.keystroke_delay?.end, MessageToSend));

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(closeChat);
                        } else {
                            await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                        }
                        break;
                    }

                    case ChatStatuses.Typing: {
                        StatusUpdate(`${mutableUsername} is typing...`);
                        break;
                    }

                    case ChatStatuses.Screenshot: {
                        StatusUpdate(`${mutableUsername} took a screenshot`);

                        if (RespondedToScreenshot.has(mutableUsername)) {
                            break;
                        }

                        //await chatSelector.click();
                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(openChat, rawConversationID);
                        } else {
                            await memorySafeEvaluate(getMessagesBackground, rawConversationID);
                        }

                        await waitForPromiseWithTimeout(new Promise((resolve) => {
                            const interval = setInterval(() => {
                                if (InChat) {
                                    resolve();
                                    clearInterval(interval);
                                }
                            });
                        }), 30000);

                        //await onceWithTimeout(Event, "displayedMessages", 30000);
                        //await once(Event, "displayedMessages");

                        console.log("Entered Chat");

                        await waitForPromiseWithTimeout(memorySafeEvaluate(sendMessage, { message: "why did u screenshot", cID: rawConversationID, InChat: (PrecenseDetails.UserInChat === true && PrecenseDetails.UserID === userID),  KeystrokeDelayLeft: config.bot_settings.keystroke_delay.start || 5, KeystrokeDelayRight: config.bot_settings.keystroke_delay.end || 70  }, WorkOutMessageTimeout(config.bot_settings.keystroke_delay?.end, "why did u screenshot")), WorkOutMessageTimeout(config.bot_settings.keystroke_delay?.end, "why did u screenshot"));
                        RespondedToScreenshot.add(mutableUsername);

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(closeChat);
                        } else {
                            await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                        }
                        break;
                    }

                    case ChatStatuses.ChatRemovedReaction:
                    case ChatStatuses.ChatReaction: {
                        StatusUpdate(`${mutableUsername} sent a reaction`);

                    
                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(openChat, rawConversationID);
                        } else {
                            await memorySafeEvaluate(getMessagesBackground, rawConversationID);
                        }
                        //await chatSelector.click();
                        await waitForPromiseWithTimeout(new Promise((resolve) => {
                            const interval = setInterval(() => {
                                if (InChat) {
                                    resolve();
                                    clearInterval(interval);
                                }
                            });
                        }), 30000);

                        //await onceWithTimeout(Event, "fetchConversationWithMessagesPaginated", 30000);

                        if (!config.bot_settings.background_mode) {
                            await memorySafeEvaluate(closeChat);
                        } else {
                            await memorySafeEvaluate(exitConversationBackground, rawConversationID);
                        }
                        break;
                    }
                    default:
                        break;
                }
            }

            lastScrollTop = await memorySafeEvaluate(scrollScript, { by: 74 * (ScrollData?.rendered || 0), last: lastScrollTop }); // ScrollData.height * ScrollData.rendered
            if (lastScrollTop >= (74 * (ScrollData?.rendered || 0))) {
                await memorySafeEvaluate(scrollScript, { by: -(lastScrollTop), last: lastScrollTop });

                await wait(1500);
                
                let jumpBack;
                let openChats = await memorySafeEvaluate(getChats);
                if (!Array.isArray(openChats)) {
                    openChats = [];
                }
                
                for (const { status, userID } of openChats) {
                    //console.log(openChats);
                    const mutableUsername = GetMutableUsernameFromID(userID);
                    //const userID = GetUserIDFromDisplay(username);
                    const Ignored = await CheckIfUserIgnored(mutableUsername);

                    if (Ignored || mutableUsername == ("myai") || mutableUsername == ("teamsnapchat")) {
                        continue;
                    }

                    if (!userID) {
                        continue;
                    }

                    switch (status) {
                        case ChatStatuses.NewSnap:
                        case ChatStatuses.NewChatsAndSnaps: 
                        case ChatStatuses.NewChat:
                            jumpBack = true;
                            break;
                        default:
                            break;
                    }

                    if (config.bot_settings.enable_mass_message) {
                        jumpBack = false;
                    }
                }

                if (!jumpBack) {
                    await memorySafeEvaluate(scrollScript, { by: lastScrollTop, last: 0 });
                }

                /*
                if (openChats.find(user => user.status == "New Chat" || user.status == "New Chats and Snaps")) {
                    console.log("1-10 have new chats");
                } else {
                    await page.evaluate(({ by, last }) => {
                        const container = document.getElementsByClassName("ReactVirtualized__Grid ReactVirtualized__List QAr02")[0];
                        container.scrollTop += by;
            
                        if (container.scrollTop === last) {
                            container.scrollTop = 0;
                        }
            
                        return container.scrollTop;
                    }, { by: lastScrollTop, last: 0 });
                }
                */

                /*
                                console.log(openChats);
                console.log("jumped back");
                
                await page.evaluate(({ by, last }) => {
                    const container = document.getElementsByClassName("ReactVirtualized__Grid ReactVirtualized__List QAr02")[0];
                    container.scrollTop += by;
        
                    if (container.scrollTop === last) {
                        container.scrollTop = 0;
                    }
        
                    return container.scrollTop;
                }, { by: lastScrollTop, last: 0 });
                */
            }
            

            ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
        } catch (er) {
            const ErrorString = er.toString();
            if (!ErrorString.includes("page.waitForSelector") ) {
                console.log(er);
                logtail.error(er.toString(), {
                    browser: {
                        name: config.name,
                        id: config.id
                    },
                    account: {
                       email: AccountInfo ? AccountInfo?.Email : "none"
                    }
                }, er);
            }

            ExecuteTasksTimeoutID = setTimeout(ExecuteTasks, config.bot_settings.task_interval);
        }
    }

    /*
    internal_shared.EnableBot = function(enabled) {
        if (enabled) {
            clearTimeout(ExecuteTasksTimeoutID);
            return ExecuteTasks();
        }
        clearTimeout(ExecuteTasksTimeoutID);
    }
    */

    return ExecuteTasks();
}