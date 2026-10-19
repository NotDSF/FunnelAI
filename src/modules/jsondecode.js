class BinaryReader {
    constructor(buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }

    readUInt8() {
        return this.buffer.readUInt8(this.offset++);
    }

    readUInt32() {
        const val = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return val;
    }

    readInt64() {
        const val = this.buffer.readBigInt64BE(this.offset);
        this.offset += 8;
        return val;
    }

    readBytes(len) {
        const buf = this.buffer.slice(this.offset, this.offset + len);
        this.offset += len;
        return buf;
    }

    readString() {
        const length = this.readUInt32(); // length prefix
        const buf = this.readBytes(length);
        return buf.toString('utf8');
    }
    
    readBuffer() {
        const length = Number(this.readInt64());
        return this.readBytes(length);
    }
}

function DecodeFormattedPacket(buffer) {
    const Reader = new BinaryReader(buffer);

    function gBits8() {
      return Reader.readUInt8();
    }

    function gInt() {
      return Reader.readUInt32()
    }

    function gString() {
      return Reader.readString()
    }

    function readInt64() {
        return Reader.readInt64();
    }

    function readBuffer() {
        return Reader.readBuffer();
    }

    let DecodeObject;
    function DecodeArray() {
        let Size = gInt();
        let arry = [];

        function HandleValue() {
            let Type = gBits8();
            switch (Type) {
                case 1:
                    return gString();
                case 2:
                    return +gString(); // float
                case 3: // uint8
                    return gBits8();
                case 4:
                    return DecodeObject();
                case 5:
                    return gBits8() == 1;
                case 6:
                    return DecodeArray();
                case 7: // Int64
                    return Number(readInt64());
                case 8: // int32
                    return gInt();
                case 9:
                    return readBuffer();
                case 0:
                    return undefined;
                default:
                    return;
            }
        }

        let Timestamp = gInt();
        if (Math.floor(Date.now() / 1000) - Timestamp > 600) {
          return;
        }

        for (let i=0; i < Size; i++) {
          arry.push(HandleValue());
        }

        return arry;
    }

    DecodeObject = function() {
        let Size = gInt();
        let Object = {};

        function HandleValue() {
            let Type = gBits8();
            switch (Type) {
                case 1:
                    return gString();
                case 2:
                    return +gString(); // float
                case 3: // uint8
                    return gBits8();
                case 4:
                    return DecodeObject();
                case 5:
                    return gBits8() == 1;
                case 6:
                    return DecodeArray();
                case 7: // Int64
                    return Number(readInt64());
                case 8: // int32
                    return gInt();
                case 9:
                    return readBuffer()
                case 0:
                    return undefined;
                default:
                    return;
            }
        }

        let Timestamp = gInt();
        if (Math.floor(Date.now() / 1000) - Timestamp > 600) {
          	return;
        }

        for (let i=0; i < Size; i++) {
            let Index = HandleValue();
            let Value = HandleValue();
            Object[Index] = Value;
        }

        return Object;
    }

    let ObjectType = gBits8();
    switch (ObjectType) {
        case 4:
            return DecodeObject();
        case 6:
            return DecodeArray();
        default:
            break;
    }
}

module.exports = DecodeFormattedPacket;