/**
 * @typedef { import("chrome-remote-interface").Client } CDPClient
*/

const { spawn } = require("node:child_process");
const net = require("node:net");
const CDP = require('chrome-remote-interface');
const EventEmitter = require("node:events");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close((err) => err ? reject(err) : resolve(port))
    });
  })
}

function FormatEvalFuncAsScript(fn) {
    return `(${fn.toString()})()`;
}

async function CheckForCDP(port) {
    return new Promise(async (resolve, reject) => {
        let Attempts = 0;
        while (true) {
            if (Attempts > 50) {
                reject();
            }

            try {
                const packet = await fetch(`http://127.0.0.1:${port}/json/version`);
                if (packet.ok) {
                    resolve();
                    break;
                }
            } catch {

            }

            Attempts++;
            await new Promise((res) => setTimeout(res, 250));
        }
    });
}

let IsClosing = false;

class SelectorConstructor {
    /**
     * 
     * @param {CDPClient} client 
    */
    constructor(client, objectId, sessionId) {
        this.client = client;
        this.objectId = objectId;
        this.sessionId = sessionId;
    }

    async evaluate(fn, ...args) {
        if (IsClosing) return;
        
        const callArguments = [];
        
        callArguments.push({ objectId: this.objectId });
        
        for (const arg of args) {
            callArguments.push({ value: arg });
        }

        const { result, exceptionDetails } = await this.client.Runtime.callFunctionOn({
            functionDeclaration: fn.toString(),
            arguments: callArguments,
            objectId: this.objectId
        }, this.sessionId);

        if (exceptionDetails) {
            throw exceptionDetails.exception.description;
        }

        return result.value;
    }
}

class PageConstructor extends EventEmitter {
    /**
     * 
     * @param {CDPClient} client 
    */
    constructor(client, sessionId, locked = false) {
        super()
        this.client = client;
        this.page = client.Page;
        this.runtime = client.Runtime;
        this.locked = locked;
        this.sessionId = sessionId;
        this.executionContextID;

        if (locked) {
            return this;
        }

        this.client.Page.loadEventFired(() => {
            this.emit("load");
        }, sessionId);

        this.client.Network.loadingFailed((event) => {
            this.emit("requestfailed", event);
        }, sessionId);

        this.runtime.on("executionContextCreated", (event) => {
            if (event.context.auxData && event.context.auxData.isDefault) {
                this.executionContextID = event.context.uniqueId;
            }
        }, sessionId);

        this.runtime.executionContextDestroyed(() => {
            this.executionContextID = null;
        })

        this.runtime.on("executionContextsCleared", (event) => {
            this.executionContextID = null;
        }, sessionId);

        client.Network.webSocketCreated((event) => {
            this.emit("websocket", event);
        }, sessionId);

        client.Network.webSocketFrameReceived((event) => {
            this.emit("websocketReceived", event);
        }, sessionId);
    }

    async goto(url, referrer) {
        if (IsClosing) return;
        
        const listener = this.page.loadEventFired(this.sessionId);
        await this.page.navigate({ url, referrer }, this.sessionId);
        await listener;
    }

    async evaluate(fn, ...args) {
        console.log("evalute called");
        if (IsClosing) return;
        
        if (this.locked) {
            throw "Locked";
        }

        if (!this.executionContextID || this.executionContextID === null) {
            console.log("tried");
            return;
        }

        const callArguments = [];
        
        for (const arg of args) {
            callArguments.push({ value: arg });
        }

        const serializedArgs = args.map(arg => JSON.stringify(arg)).join(', ');

        // 2. Wrap the function and call it with the args inline
        const expression = `(${fn.toString()})(${serializedArgs})`;

        try {
            const { result, exceptionDetails } = await this.runtime.evaluate({
                expression,
                //uniqueContextId: this.executionContextID,
                returnByValue: true,
                awaitPromise: true
            }, this.sessionId);

            console.log("aaaaa", result, exceptionDetails);

            if (exceptionDetails) {
                console.log(exceptionDetails.exception.description);
                return;
            }

            return result.value;
        } catch (er) {
            console.log(er);
            //throw er;
            return;
        }
    }

    async close() {
        IsClosing = true;
        await this.page.close();
    }

    async url() {
        if (IsClosing) return;
        
        const frameTree = await this.page.getFrameTree(this.sessionId);
        return frameTree.frameTree.frame?.url || '';
    }

    async reload() {
        if (IsClosing) return;
        
        
        await this.page.reload({ ignoreCache: false }, this.sessionId);
    }

    async scriptParsed(fn) {
        if (IsClosing) return;
        
        if (this.locked) {
            throw "Locked";
        }

        this.client.Debugger.scriptParsed(async (event) => {
            if (event.scriptLanguage !== "JavaScript") {
                return;
            }
            try {
                await fn(this.client.Debugger, event, this.sessionId);
            } catch (er) {
                console.log(er);
            }
        }, this.sessionId);
    }

    async paused(fn) {
        if (IsClosing) return;
        
        if (this.locked) {
            throw "Locked";
        }

        this.client.Debugger.paused(async (event) => {
            try {
                await fn(this.client.Debugger, event, this.sessionId);
            } catch (er) {
                console.log(er);
            }
        }, this.sessionId);
    }

    async requestGC() {
        if (IsClosing) return;
        
        await this.client.HeapProfiler.enable(this.sessionId);
        await this.client.HeapProfiler.collectGarbage(this.sessionId);
        await this.client.HeapProfiler.disable(this.sessionId);
    }

    async getSelector(selector) {
        if (IsClosing) return;
        
        try {
            const { result, exceptionDetails } = await this.client.Runtime.evaluate({ expression: `document.querySelector('${selector}')` }, this.sessionId);

            if (exceptionDetails) {
                throw new Error(exceptionDetails.exception.description);
            }

            if (result.objectId) {
                return new SelectorConstructor(this.client, result.objectId, this.sessionId);
            }

            return;
        } catch {
            return;
        }
    }
}

class Browser extends EventEmitter {
    constructor() {
        super()
        this.pages = [];
        this.port;
        this.client;
        this.routePattern;
        this.routeEvent;
        this.functions = {};
        this.initScripts = [];
    }

    async launchPersistentContext(userDataDir, options) {
        const port = await getFreePort();

        const BrowserArguments = [
            `--remote-debugging-port=${port}`,
            `--user-data-dir=${userDataDir}`,
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
            "--noerrdialogs",
            "--disable-field-trial-config",
            "--disable-background-networking",
            "--disable-back-forward-cache",
            "--disable-component-extensions-with-background-pages",
            "--disable-features=AcceptCHFrame,AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate",
            "--allow-pre-commit-input",
            "--disable-ipc-flooding-protection",
            "--no-first-run",
            "--password-store=basic",
            "--export-tagged-pdf",
            "--disable-search-engine-choice-screen",
            "--unsafely-disable-devtools-self-xss-warnings",
            "--edge-skip-compat-layer-relaunch",
            "--no-sandbox",
            "--webrtc-ip-handling-policy=disable_non_proxied_udp"
        ];

        if (typeof(options) == "object") {
            if (options.launchURL) {
                BrowserArguments.push(options.launchURL);
            }

            if (options.args) {
                for (const arg of options.args) {
                    BrowserArguments.push(arg);
                }
            }

            if (options.userAgent) {
                this.userAgent = options.userAgent;
                BrowserArguments.push(`--user-agent=\"${options.userAgent}\"`)
            }

            if (options.timezoneId) {
                this.timezoneId = options.timezoneId;
            }

            if (options.colorScheme) {
                this.colorScheme = options.colorScheme;
            }

            if (options.executablePath) {
                this.executablePath = options.executablePath;
            }

            if (options.proxy) {
                BrowserArguments.push(`--proxy-server=${options.proxy.server}`);
                this.proxySettings = options.proxy;
            }
        }

        const chrome = spawn(this.executablePath, BrowserArguments); 
        chrome.on("exit", (code) => {
            this.emit("close", code);
        });

        this.pid = chrome.pid;

        process.on("exit", () => chrome.kill());

        await CheckForCDP(port);
        console.log(`Conntected to port ${port}`);

        const client = await CDP({ port, local: true });

        client.Page.enable();

        const page = new PageConstructor(client, true);
        this.pages.push(page);
        this.port = port;
        this.client = client;
        return this;
    }

    async newPage() {
        if (IsClosing) return;
        
        const { targetId } = await this.client.Target.createTarget({ url: "about:blank" });
        const { sessionId } = await this.client.Target.attachToTarget({ targetId, flatten: true });

        //const target = await CDP.New({ port: this.port });
        //const client = await CDP({ port: this.port, target });
        //const { Network, Page, Runtime, Debugger, Animation, Console } = this.client;
        await this.client.Network.enable({}, sessionId);
        await this.client.Page.enable({}, sessionId);
        await this.client.Runtime.enable({}, sessionId);
        await this.client.Debugger.enable({}, sessionId);
        await this.client.Animation.enable({}, sessionId);
        await this.client.Console.enable({}, sessionId);
        

       // await Emulation.enable();

        if (this.userAgent) {
            await this.client.Network.setUserAgentOverride({
                userAgent: this.userAgent,
            }, sessionId);

            await this.client.Emulation.setUserAgentOverride({
                userAgent: this.userAgent,
            }, sessionId);
        }

        if (this.timezoneId) {
            await this.client.Emulation.setTimezoneOverride({
                timezoneId: this.timezoneId
            }, sessionId);
        }

        if (this.colorScheme) {
            await this.client.Emulation.setEmulatedMedia({
                features: [{
                    name: 'prefers-color-scheme',
                    value: this.colorScheme
                }]
            }, sessionId);
        }

        await this.client.Emulation.setHardwareConcurrencyOverride({
            hardwareConcurrency: 4
        }, sessionId);

        await this.client.Runtime.addBinding({ name: "lrsfoexfgnlcchxcbq" }, sessionId);

        await this.client.Runtime.bindingCalled(async (event) => {
            if (IsClosing) return;

            const { name, payload } = event;
            if (name !== "lrsfoexfgnlcchxcbq") return;

            try {
                const { name, args, id } = JSON.parse(payload);
                if (this.functions[name]) {
                    try {
                        const result = await this.functions[name](...args);
                        await this.client.Runtime.evaluate({ expression: `window.lrsfoexfgnlcchxcbx('${id}', ${result ? JSON.stringify(JSON.stringify(result)) : undefined})` }, sessionId);
                    } catch (er) {
                        await this.client.Runtime.evaluate({ expression: `window.lrsfoexfgnlcchxcbxd('${id}', ${er ? JSON.stringify(JSON.stringify(er.toString())) : er})` }, sessionId);
                    }
                }
            } catch (er) {
                console.log(er);
            }
        }, sessionId);

        await this.client.Page.addScriptToEvaluateOnNewDocument({
            source: `
                window.lrsfoexfgnlcchxcbb = new Map();

                window.lrsfoexfgnlcchxcbx = function(id, result) {
                    const promise = window.lrsfoexfgnlcchxcbb.get(id);
                    if (promise) {
                        promise.resolve(result ? JSON.parse(result) : undefined);
                        window.lrsfoexfgnlcchxcbb.delete(id);
                    }
                }

                window.lrsfoexfgnlcchxcbxd = function(id, error) {
                    const promise = window.lrsfoexfgnlcchxcbb.get(id);
                    if (promise) {
                        promise.reject(error ? JSON.parse(error) : error);
                        window.lrsfoexfgnlcchxcbb.delete(id);
                    }
                }

                const original = window['lrsfoexfgnlcchxcbq'];
                window['lrsfoexfgnlcchxcbq'] = function(name, ...args) {
                    const id = crypto.randomUUID();
                    return new Promise((resolve, reject) => {
                        window.lrsfoexfgnlcchxcbb.set(id, { resolve, reject });
                        const payload = JSON.stringify({ id, name, args });
                        original(payload);
                    });
                }
            `
        }, sessionId);

        for (const name of Object.keys(this.functions)) {
            await this.client.Page.addScriptToEvaluateOnNewDocument({ source: `window['${name}']= async function(...args) { return await window['lrsfoexfgnlcchxcbq']('${name}',...args); } ` }, sessionId)
        }

        for (const source of this.initScripts) {
            await this.client.Page.addScriptToEvaluateOnNewDocument({ source }, sessionId);
        }

        const page = new PageConstructor(this.client, sessionId);
        this.pages.push(page);
        return page;
    }

    async newLightweightPage(url) {
        if (IsClosing) return;
        
        const { targetId } = await this.client.Target.createTarget({ url: "about:blank" });
        const { sessionId } = await this.client.Target.attachToTarget({ targetId, flatten: true });
       
        this.client.Page.enable({}, sessionId);

        const page = new PageConstructor(client, sessionId, true);
        this.pages.push(page);
        return page;
    }

    async close() {
        IsClosing = true;        
        await this.client.Browser.close();
    }

    async cookies() {
        if (IsClosing) return;
        
        const { cookies } = await this.client.Network.getAllCookies();
        return cookies;
    }

    async addCookies(cookies) {
        if (IsClosing) return;
        
        await this.client.Network.setCookies({ cookies });
    }

    async route(pattern, fn) {
        this.routePattern = pattern;
        this.routeEvent = fn
    }

    async exposeFunction(name, fn) {
        this.functions[name] = fn;
    }

    async addInitScript(fn) {
        this.initScripts.push(FormatEvalFuncAsScript(fn));
    }
}

module.exports = Browser;