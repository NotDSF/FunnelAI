let AuthToken;

async function SendToServer(type, data) {
  console.log(type, data);
  return;
  try {
    await fetch(("http://127.0.0.1:8081/api/logs"), {
      method: "POST",
      headers: {
        ["content-type"]: "application/json",
        ["Authorization"]: AuthToken || ("7f5do5pKptpTlk")
      },
      body: JSON.stringify({ type, data })
    })
  } catch (er) {
    console.log(er);
  }
}

class Logger {
  log(data) {
    SendToServer("log", data);
  }
  warn(data) {
    SendToServer("warn", data);
  }
  debug(data) {
    SendToServer("debug", data);
  }
  error(data) {
    SendToServer("error", data);
  }
  info(data) {
    SendToServer("info", data);
  }
  setAuth(auth) {
    AuthToken = auth;
  }
}

module.exports = new Logger();
