
const { readFileSync } = require("fs"); 
const xlsx = require("node-xlsx").default;

function DeserializeAdsPowerExport(dir) {
    const Data = xlsx.parse(readFileSync(dir))[0].data;
    const Indexes = Data.shift();
    const Constructed = [];
    for (const Value of Data) {
        Constructed.push({
            Name: Value[Indexes.indexOf("name")],
            Note: Value[Indexes.indexOf("remark")],
            Cookie: Value[Indexes.indexOf("cookie")],
            UserAgent: Value[Indexes.indexOf("ua")],
            Proxy: Value[Indexes.indexOf("proxy")],
            ProxyType: Value[Indexes.indexOf("proxytype")]
        });
    }
    return Constructed;
}

module.exports = DeserializeAdsPowerExport;

//console.log(DeserializeAdsPowerExport(path.join(__dirname, "multi.xlsx")));