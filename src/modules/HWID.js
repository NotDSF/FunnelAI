const { execSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const path = require("node:path");

// vol C:
// wmic csproduct get uuid
// wmic memorychip get serialnumber
// wmic baseboard get serialnumber

const PowershellPath = path.join(process.env.SystemRoot || "C:\\WINDOWS", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
function RunPowershell(command) {
    return execSync(`"${PowershellPath}" -NoProfile -ExecutionPolicy Bypass -Command \"${command}\"`);
}

module.exports = (() => {
    const Data = RunPowershell(("[pscustomobject]@{A=(Get-CimInstance Win32_ComputerSystemProduct).UUID;B=(Get-CimInstance Win32_BIOS).Manufacturer;C=(Get-CimInstance Win32_DiskDrive|Select-Object -First 1).SerialNumber;D=(Get-CimInstance Win32_OperatingSystem).InstallDate.ToString('dd MMMM yyyy HH:mm:ss')} | ConvertTo-Json -Compress"))
    const { A, B, C, D } = JSON.parse(Data.toString());

    const HWID = createHash(("sha512"));
    HWID.update(
        A.toString().trim() +
        B.toString().trim() +
        C.toString().trim() +
        D.toString().trim()
    );

    return HWID.digest("hex");
});