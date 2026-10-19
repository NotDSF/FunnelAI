const { writeFileSync, readFileSync } = require("node:fs");
const crypto = require("node:crypto");

const iv = Buffer.alloc(16, 0);

module.exports = class DataStorage {
    WriteFile(path, data, key) {
        writeFileSync(path, data);
    }

    WriteFileBuffer(path, data, key) {
        writeFileSync(path, data);
    }

    ReadFileBuffer(path, key) {
        return readFileSync(path);
    }

    ReadFile(path, key) {
        return readFileSync(path, "utf-8");
    } 

    DecryptRaw(data, key) {
        const decipher = crypto.createDecipheriv("aes-128-cbc", crypto.createHash('sha256').update(key + ("YuGlcl2AWLOcJLLMOAC00VVRzu9qPj3w")).digest().slice(0, 16), iv);
        let decrypted = decipher.update(Buffer.from(data, "hex"));
        decrypted = Buffer.concat([decrypted, decipher.final()])
        return decrypted.toString("utf-8");
    } 

    EncryptRawToHex(data, key) {
        const cipher = crypto.createCipheriv("aes-128-cbc", crypto.createHash('sha256').update(key + ("YuGlcl2AWLOcJLLMOAC00VVRzu9qPj3w")).digest().slice(0, 16), iv);
        let encrypted = cipher.update(data, "utf8");
        encrypted = Buffer.concat([encrypted, cipher.final()])
        return encrypted.toString("hex");
    }

    EncryptRawToBuffer(data, key) {
        const cipher = crypto.createCipheriv("aes-128-cbc", crypto.createHash('sha256').update(key + ("YuGlcl2AWLOcJLLMOAC00VVRzu9qPj3w")).digest().slice(0, 16), iv);
        let encrypted = cipher.update(data, "utf8");
        encrypted = Buffer.concat([encrypted, cipher.final()])
        return encrypted;
    }

    EncryptBufferToBuffer(data, key) {
        const cipher = crypto.createCipheriv("aes-128-cbc", crypto.createHash('sha256').update(key + ("YuGlcl2AWLOcJLLMOAC00VVRzu9qPj3w")).digest().slice(0, 16), iv);
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()])
        return encrypted;
    }

    DecryptBufferToBuffer(data, key) {
        const decipher = crypto.createDecipheriv("aes-128-cbc", crypto.createHash('sha256').update(key + ("YuGlcl2AWLOcJLLMOAC00VVRzu9qPj3w")).digest().slice(0, 16), iv);
        let decrypted = decipher.update(data);
        decrypted = Buffer.concat([decrypted, decipher.final()])
        return decrypted;
    }

    DecryptRawFromBuffer(data, key) {
        const decipher = crypto.createDecipheriv("aes-128-cbc", crypto.createHash('sha256').update(key + ("YuGlcl2AWLOcJLLMOAC00VVRzu9qPj3w")).digest().slice(0, 16), iv);
        let decrypted = decipher.update(data);
        decrypted = Buffer.concat([decrypted, decipher.final()])
        return decrypted.toString("utf-8");
    } 
}