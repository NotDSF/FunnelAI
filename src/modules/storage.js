const { existsSync, mkdirSync, writeFileSync } = require("fs");
const defaultappconfig = require("./defaultappconfig");
const path = require("path");

if (!existsSync(path.join(__appdir, "storage"))) {
    mkdirSync(path.join(__appdir, "storage"));
}

if (!existsSync(path.join(ROAMING_DIR, "storage"))) {
    mkdirSync(path.join(ROAMING_DIR, "storage"));
}

if (!existsSync(path.join(__appdir, "storage/model-images"))) {
    mkdirSync(path.join(__appdir, "storage/model-images"));
}

if (!existsSync(path.join(ROAMING_DIR, "storage/browser-states"))) {
    mkdirSync(path.join(ROAMING_DIR, "storage/browser-states"));
}

if (!existsSync(path.join(ROAMING_DIR, "storage/browser-cache"))) {
    mkdirSync(path.join(ROAMING_DIR, "storage/browser-cache"));
}

if (!existsSync(path.join(__appdir, "storage/app.json"))) {
    writeFileSync(path.join(__appdir, "storage/app.json"), JSON.stringify(defaultappconfig, null, 4));
}

if (!existsSync(path.join(__appdir, "storage/state.json"))) {
    writeFileSync(path.join(__appdir, "storage/state.json"), JSON.stringify({}));
}

