class BinaryWriter {
    constructor(size = 1024) {
        this.buffer = Buffer.allocUnsafe(size);
        this.offset = 0;
    }

    _ensure(n) {
        if (this.offset + n > this.buffer.length) {
            let newSize = Math.max(this.buffer.length * 2, this.offset + n);
            const newBuf = Buffer.allocUnsafe(newSize);
            this.buffer.copy(newBuf, 0, 0, this.offset);
            this.buffer = newBuf;
        }
    }

    writeUInt8(v) { this._ensure(1); this.buffer.writeUInt8(v, this.offset); this.offset += 1; }

    writeBytes(buf) { this._ensure(buf.length); buf.copy(this.buffer, this.offset); this.offset += buf.length; }
    writeUInt32(v) { this._ensure(4); this.buffer.writeUInt32BE(v, this.offset); this.offset += 4; } 
    writeInt64(v)  { this._ensure(8); this.buffer.writeBigInt64BE(typeof v === 'bigint' ? v : BigInt(v), this.offset); this.offset += 8; }

    writeString(str) {
        const utf8 = Buffer.from(str, 'utf8');
        this.writeUInt32(utf8.length); 
        this.writeBytes(utf8);
    }

    writeBuffer(buf) {
        this.writeInt64(BigInt(buf.length));
        this.writeBytes(buf);
    }

    toBuffer() { return this.buffer.slice(0, this.offset); }

    reset() { this.offset = 0; }
}

function IsFloat(n) {
    return Number(n) === n && n % 1 !== 0;
}

const STRING_HEADER_INT = +("1");
const NUMBER_HEADER_INT = +("3");

function ClientFormatPacket(object) {
    const Writer = new BinaryWriter();

    function writeInt(int) {
        Writer.writeUInt32(int);
    }

    function writeGbits8(byte) {
        Writer.writeUInt8(byte);
    }

    function writeString(string) {
        Writer.writeString(string);
    }

    function writeNumber(number) {
        writeInt(number);
    }

    let writeChunk;
    function writeArray(arry) {
        writeInt(arry.length);
        writeInt(Math.floor(Date.now() / 1000));
 
        for (let v of Object.values(arry)) {
            switch (typeof(v)) {
                case "string":
                    writeGbits8(STRING_HEADER_INT); // string header
                    writeString(v);
                    break;
                case "number":
                    if (IsFloat(v) || v < 0) {
                        writeGbits8(2);
                        writeString(v.toString());
                        break;
                    }

                    if (v <= 255) {
                        writeGbits8(NUMBER_HEADER_INT); // uint8
                        Writer.writeUInt8(v);
                        break;
                    } else if (v <= 4294967295) {
                        writeGbits8(8)
                        Writer.writeUInt32(v);
                        break;
                    } else if (v <= Number.MAX_SAFE_INTEGER) {
                        writeGbits8(7);
                        Writer.writeInt64(v);
                        break;
                    }
                    break;
                case "object":
                    if (v instanceof Date) {
                        writeGbits8(7) // date header
                        Writer.writeInt64(v.getTime());
                        break;
                    }

                    if (v instanceof Buffer) {
                        writeGbits8(9) // buffer header
                        Writer.writeBuffer(v);
                        break;
                    }

                    if (Array.isArray(v)) {
                        writeGbits8(6); // array header
                        writeArray(v);
                        break;
                    }

                    if (v === null || v === undefined) {
                        writeGbits8(0);
                        break;
                    }

                    writeGbits8(4);
                    writeChunk(v);
                    break;
                case "boolean":
                    writeGbits8(5);
                    writeGbits8(v == true ? 1 : 0);
                    break;
                case "undefined":
                    writeGbits8(0);
                    break;
                default:
                    break;
            }
        }
    } 
    
    writeChunk = function(object) {
        writeInt(Object.values(object).length);
        writeInt(Math.floor(Date.now() / 1000));

        for (let i in object) {
            const v = object[i];

            switch (typeof(i)) {
                case "string":
                    writeGbits8(STRING_HEADER_INT); // string header
                    writeString(i);
                    break
                case "number":
                    if (IsFloat(i) || i < 0) {
                        writeGbits8(2);
                        writeString(i.toString());
                        break;
                    }

                    writeGbits8(NUMBER_HEADER_INT); // number header
                    writeNumber(i)
                    break;
                default:
                    break;
            }
    
            switch (typeof(v)) {
                case "string":
                    writeGbits8(STRING_HEADER_INT); // string header
                    writeString(v);
                    break;
                case "number":
                    if (IsFloat(v) || v < 0) {
                        writeGbits8(2);
                        writeString(v.toString());
                        break;
                    }

                    if (v <= 255) {
                        writeGbits8(NUMBER_HEADER_INT); // uint8
                        Writer.writeUInt8(v);
                        break;
                    } else if (v <= 4294967295) {
                        writeGbits8(8)
                        Writer.writeUInt32(v);
                        break;
                    } else if (v <= Number.MAX_SAFE_INTEGER) {
                        writeGbits8(7);
                        Writer.writeInt64(v);
                        break;
                    }
                    break;
                case "object":
                    if (v instanceof Date) {
                        writeGbits8(7) // date header
                        Writer.writeInt64(v.getTime());
                        break;
                    }

                    if (v instanceof Buffer) {
                        writeGbits8(9) // buffer header
                        Writer.writeBuffer(v);
                        break;
                    }
    
                    if (Array.isArray(v)) {
                        writeGbits8(6);
                        writeArray(v);
                        break;
                    }

                    if (v === null || v === undefined) {
                        writeGbits8(0);
                        break;
                    }

                    writeGbits8(4);
                    writeChunk(v);
                    break;
                case "boolean":
                    writeGbits8(5);
                    writeGbits8(v == true ? 1 : 0);
                    break;
                case "undefined":
                    writeGbits8(0);
                    break;
                default:
                    break;
            }
        }
    }

    if (Array.isArray(object)) {
        writeGbits8((6));
        writeArray(object);
    } else {
        writeGbits8(4);
        writeChunk(object);
    }

    return Writer.toBuffer();
}

module.exports = ClientFormatPacket;