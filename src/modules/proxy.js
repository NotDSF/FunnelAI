const https = require("https");

const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");

module.exports = class CheckProxy {
    async CheckHTTP(IP, Port, Username, Password) {
        return new Promise(async (resolve, reject) => {
            const agent = new HttpsProxyAgent(`http://${Username}:${Password}@${IP}:${Port}`);

            try {
                https.get(("https://ipinfo.io/json?token=05335aa7380d7a"), { agent }, (res) => {
                    if (res.statusCode !== 200) {
                        return resolve(null);
                    }
                
                    res.setEncoding("utf-8");
                    res.on("data", (data) => {
                        try {
                            agent.destroy();
                            resolve(JSON.parse(data));
                        } catch (er) {
                            agent.destroy();
                            resolve(null);
                        }
                    });
                }).on("error", () => {
                    agent.destroy();
                    resolve(null);
                });
            } catch (er) {
                resolve(null);
            }
        });
    }

    async CheckSOCKS5(IP, Port, Username, Password) {
        return new Promise(async (resolve, reject) => {
            const agent = new SocksProxyAgent(`socks5://${Username}:${Password}@${IP}:${Port}`);

            try {
                https.get(("https://ipinfo.io/json?token=05335aa7380d7a"), { agent }, (res) => {
                    if (res.statusCode !== 200) {
                        return resolve(null);
                    }
                
                    res.setEncoding("utf-8");
                    res.on("data", (data) => {
                        try {
                            agent.destroy();
                            resolve(JSON.parse(data));
                        } catch (er) {
                            agent.destroy();
                            resolve(null);
                        }
                    });
                }).on("error", () => {
                    agent.destroy();
                    resolve(null);
                });
            } catch (er) {
                resolve(null);
            }
        });
    }
}

