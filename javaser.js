// primitive types
//     * B            byte
//     * C            char
//     * D            double
//     * F            float
//     * I            int
//     * J            long
//     * L            class or interface
//     * S            short
//     * Z            boolean
//     * [            array

function Null() {
}

function Boolean(val) {
	this.isTrue = val == true;
	this.typeCode = 'Z';
	this.primitive = true;

	this.write = function(out) {
		if (val == true) {
			out.writeByte(1)
		} else {
			out.writeByte(0);
		}
	}
}

function Byte(val) {
	this.val = val;
	this.typeCode = 'B';
	this.primitive = true;

	this.write = function(out) {
		out.writeByte(val);
	}
}

function Short(val) {
	this.val = val;
	this.typeCode = 'S';
	this.primitive = true;

	this.write = function(out) {
		out.writeByte((val >> 8) & 0xFF);
		out.writeByte(val & 0xFF);
	}
}

function Char(val) {
	this.val = val;
	this.typeCode = 'C';
	this.primitive = true;

	this.write = function(out) {
		out.writeByte((val >> 8) & 0xFF);
		out.writeByte(val & 0xFF);
	}
}

function Integer(val) {
	this.val = val;
	this.typeCode = 'I';
	this.primitive = true;

	this.write = function(out) {
		out.writeByte((val >> 24) & 0xFF);
		out.writeByte((val >> 16) & 0xFF);
		out.writeByte((val >> 8) & 0xFF);
		out.writeByte(val & 0xFF);
	}
}

function Long(high, low) {
	this.high = high;
	this.low = low;
	this.typeCode = 'J';
	this.primitive = true;

	this.write = function(out) {
		out.writeByte((high >> 24) & 0xFF);
		out.writeByte((high >> 16) & 0xFF);
		out.writeByte((high >> 8) & 0xFF);
		out.writeByte(high & 0xFF);
		out.writeByte((low >> 24) & 0xFF);
		out.writeByte((low >> 16) & 0xFF);
		out.writeByte((low >> 8) & 0xFF);
		out.writeByte(low & 0xFF);
	}
}

function Float(val) {
	this.val = val;
	this.typeCode = 'F';
	this.primitive = true;

	this.write = function(out) {
		throw "Unimplemented";
	}
}

function Double(val) {
	this.val = val;
	this.typeCode = 'D';
	this.primitive = true;

	this.write = function(out) {
		throw "Unimplemented";
	}
}

function Array(type, vals) {
	this.type = type;
	this.vals = vals;
	this.typeCode = '[';
	this.primitive = false;

	this.write = function(out) {
		new Integer(vals.length).write(out);
		for (var i = 0; i < vals.length; i++) {
			vals[i].write(out);
		}
	}
}

function String(val) {
	this.val = val;
	this.primitive = false;

	this.writeBytes = function(out) {
		for (var i = 0; i < val.length; i++) {
			out.writeByte(val.charCodeAt(i) & 0xFF);
		}
	}

	this.writeChars = function(out) {
		for (var i = 0; i < val.length; i++) {
			out.writeChar(val.charCodeAt(i) & 0xFFFF);
		}
	}

	this.writeUTF = function(out) {
		var utf8b = this.encodeUTF();
		for (var i = 0; i < utf8b.length; i++) {
			out.writeByte(utf8b.charCodeAt(i) & 0xFF);
		}
	}

	this.encodeUTF = function() {
		// per
		// http://ecmanaut.blogspot.de/2006/07/encoding-decoding-utf8-in-javascript.html
		return unescape(encodeURIComponent(val));
	}
}

function Enum(val) {
	this.primitive = false;
}

function Class(name) {
	this.primitive = false;
	this.name = name;
}

function ObjectStreamField(name, val) {
	this.name = name;
	this.val = val;
	this.unshared = false;
}

function ObjectStreamClass(name, serialHigh, serialLow, fields, opts) {
	this.class = new Class(name);
	this.superClass = null;
	this.primitive = false;
	this.proxy = false;
	this.enum = false;
	this.serialVersionHigh = serialHigh;
	this.serialVersionLow = serialLow;
	this.fields = fields;

	for ( var key in opts) {
		if (opts.hasOwnProperty(key)) {
			this[key] = opts[key];
		}
	}

	var SC_WRITE_METHOD = 0x01;
	var SC_BLOCK_DATA = 0x08;
	var SC_SERIALIZABLE = 0x02;
	var SC_EXTERNALIZABLE = 0x04;
	var SC_ENUM = 0x10;

	this.write = function(out) {
		out.writeUTF(name);
		new Long(this.serialVersionHigh, this.serialVersionLow).write(out);
		var flags = 0;
		if ('writeExternal' in this) {
			flags |= SC_EXTERNALIZABLE;
			if (out.protocol != 1) {
				flags |= SC_BLOCK_DATA;
			}
		} else {
			flags |= SC_SERIALIZABLE;
		}

		if ('writeObject' in this) {
			flags |= SC_WRITE_METHOD;
		}
		if (this.enum) {
			flags |= SC_ENUM;
		}
		out.writeByte(flags);

		new Short(this.fields.length).write(out);
		
		for (var i = 0; i < this.fields.length; i++) {
			var f = this.fields[i];
			var tc = 0;
			if ('typeString' in f) {
				tc = f.typeString.charCodeAt(0);
			} else {
				tc = f.typeCode.charCodeAt(0);
			}
			out.writeByte(tc);
			out.writeUTF(f.name);
			if ('typeString' in f) {
				out.writeTypeString(f.typeString);
			}
		}
	}

	this.getClassDataLayout = function() {
		if ( this.superClass ) {
			var r = this.superClass.getClassDataLayout();
			r.push(this);
			return r;
		}
		return [ this ];
	}

	this.writePrimitives = function(out, vals) {
		var buf = new DataOutput([]);
		for (var i = 0; i < this.fields.length; i++) {
			if (!('typeString' in this.fields[i])) {
				var v;
				if ( this.fields[i].name in vals ) {
					v = vals[this.fields[i].name];
				}
				else {
					var tc = this.fields[i].typeCode;
					if ( tc == 'I') {
						v = new Integer(0);
					} else if ( tc == 'Z' ) {
						v = new Boolean(false);
					} else if ( tc == 'B' ) {
						v = new Byte(0);
					} else if ( tc == 'S' ) {
						v = new Short(0);
					} else if ( tc == 'C' ) {
						v = new Char(0);
					} else if ( tc == 'L' ) {
						v = new Long(0);
					} else {
						throw "Missing primitive value " + this.fields[i].name;
					}
				} 
				v.write(buf);
			}
		}
		out.writeBytes(buf.out);
	}

	this.getObjectFieldDescriptors = function() {
		var res = [];
		for (var i = 0; i < this.fields.length; i++) {
			if ('typeString' in this.fields[i]) {
				res.push(this.fields[i]);
			}
		}
		return res;
	}
}

function Object(clazz, fieldVals) {
	this.clazz = clazz;
	this.typeCode = 'L';
	this.values = fieldVals;
}

function DataOutput(out) {
	this.out = out;
	this.written = 0;

	this.writeByte = function(b) {
		this.out.push(b);
		this.written++;
	}

	this.writeBytes = function(bs) {
		this.out.push.apply(this.out, bs);
		this.written += bs.length;
	}
}

function ObjectHandles() {
	this.handles = []

	this.clear = function() {
	}
	this.assign = function(obj) {
		if (obj == null || this.handles.indexOf(obj) < 0) {
			return;
		}
		this.handles.push(obj);
	}

	this.lookup = function(obj) {
		return this.handles.indexOf(obj);
	}
}

function ObjectOutput(out, opts) {
	var STREAM_MAGIC = 0xaced;
	var STREAM_VERSION = 5;
	var TC_BASE = 0x70;
	var TC_NULL = 0x70;
	var TC_REFERENCE = 0x71;
	var TC_CLASSDESC = 0x72;
	var TC_OBJECT = 0x73;
	var TC_STRING = 0x74;
	var TC_ARRAY = 0x75;
	var TC_CLASS = 0x76;
	var TC_BLOCKDATA = 0x77;
	var TC_ENDBLOCKDATA = 0x78;
	var TC_RESET = 0x79;
	var TC_BLOCKDATALONG = 0x7A;
	var TC_EXCEPTION = 0x7B;
	var TC_LONGSTRING = 0x7C;
	var TC_PROXYCLASSDESC = 0x7D;
	var TC_ENUM = 0x7E;
	var TC_MAX = 0x7E;
	var baseWireHandle = 0x7e0000;

	this.blockMode = true;
	this.blockBuf = [];
	this.blockPos = 0;
	this.depth = 0;
	this.handles = new ObjectHandles();
	this.protocol = 2;

	for ( var key in opts) {
		if (opts.hasOwnProperty(key)) {
			this[key] = opts[key];
		}
	}

	this.writeHeader = function() {
		new Short(STREAM_MAGIC).write(out);
		new Short(STREAM_VERSION).write(out);
	}

	this.setBlockMode = function(bm) {
		var obm = this.blockMode;
		if (obm == bm) {
			return obm;
		}
		this.flush();
		this.blockMode = bm;
		return obm;
	}

	this.flush = function() {
		if (this.blockPos == 0) {
			return;
		}
		if (this.blockMode) {
			this.writeBlockHeader(this.blockPos);
		}

		out.writeBytes(this.blockBuf);
		this.blockBuf = [];
		this.blockPos = 0;
	}

	this.clear = function() {
		this.handles.clear();
	}

	this.writeBlockHeader = function(len) {
		if (len <= 0xFF) {
			out.writeByte(TC_BLOCKDATA);
			out.writeByte(len);
		} else {
			out.writeByte(TC_BLOCKDATALONG);
			new Integer().write(out);
		}
	}

	this.writeByte = function(b) {
		if (this.blockMode) {
			this.blockBuf.push(b);
			this.blockPos += 1;
		} else {
			out.writeByte(b);
		}
	}

	this.writeBytes = function(bs) {
		if (this.blockMode) {
			this.blockBuf += bs;
			this.blockPos += bs.length;
		} else {
			out.writeBytes(bs);
		}
	}

	this.writeNull = function() {
		this.writeByte(TC_NULL);
	}

	this.writeHandle = function(handle) {
		this.writeByte(TC_REFERENCE);
		new Integer(baseWireHandle + handle).write(out);
	}

	this.writeClass = function(clazz, unshared) {
		this.writeByte(TC_CLASS);
		this.writeClassDesc(ObjectStreamClass.lookup(cl, true), false);
		this.handles.assign(unshared ? null : cl);
	}

	this.writeClassDesc = function(desc, unshared) {
		var handle;
		if (desc == null) {
			this.writeNull();
		} else if (!unshared && (handle = this.handles.lookup(desc)) != -1) {
			this.writeHandle(handle);
		} else if (desc.proxy) {
			this.writeProxyDesc(desc, unshared);
		} else {
			this.writeNonProxyDesc(desc, unshared);
		}
	}

	this.writeProxyDesc = function(desc, unshared) {
		this.writeByte(TC_PROXYCLASSDESC);
		this.handles.assign(unshared ? null : desc);

		var cl = desc.forClass();
		var ifaces = cl.getInterfaces();
		bout.writeInt(ifaces.length);
		for (var i = 0; i < ifaces.length; i++) {
			this.writeUTF(ifaces[i].getName(), true);
		}

		// empty annotation block
		this.setBlockMode(true);
		if ('annotateProxyClass' in this) {
			this.annotateProxyClass(desc.class);
		}
		this.setBlockMode(false);
		out.writeByte(TC_ENDBLOCKDATA);

		this.writeClassDesc(desc.superClass, false);
	}

	this.writeNonProxyDesc = function(desc, unshared) {
		this.writeByte(TC_CLASSDESC);
		this.handles.assign(unshared ? null : desc);

		desc.write(this);
		// empty annotation block
		this.setBlockMode(true);
		if ('annotateClass' in this) {
			this.annotateClass(desc.class);
		}
		this.setBlockMode(false);
		out.writeByte(TC_ENDBLOCKDATA);

		this.writeClassDesc(desc.superClass, false);
	}

	this.writeString = function(str, unshared) {
		this.handles.assign(unshared ? null : str);
		var utflen = unescape(encodeURIComponent(str)).length;
		if (utflen <= 0xFFFF) {
			this.writeByte(TC_STRING);
			this.writeUTFLen(str, utflen);
		} else {
			this.writeByte(TC_LONGSTRING);
			this.writeLongUTF(str, utflen);
		}
	}

	this.writeUTF = function(str) {
		this.writeUTFLen(str, unescape(encodeURIComponent(str)).length);
	}

	this.writeUTFLen = function(str, len) {
		if (len > 0xFFFF) {
			throw "Length exceeded";
		}

		new Short(len).write(this);
		if (len == str.length) {
			new String(str).writeBytes(this);
		} else {
			throw "Unimplemented (non-ASCII string)";
		}
	}

	this.writeLongUTF = function(str, len) {
		new Long(len).write(this);
		if (len == str.length) {
			str.writeBytes(this);
		} else {
			throw "Unimplemented (non-ASCII string)";
		}
	}

	this.writeEnum = function(en, desc, unshared) {
		this.writeByte(TC_ENUM);
		var sdesc = desc.getSuperDesc();
		writeClassDesc((sdesc.forClass() == Enum.class) ? desc : sdesc, false);
		this.handles.assign(unshared ? null : en);
		this.writeString(en.name(), false);
	}

	this.writeArray = function(array, desc, unshared) {
		this.writeByte(TC_ARRAY);
		this.writeClassDesc(desc, false);
		this.handles.assign(unshared ? null : array);
		var ccl = desc.forClass().getComponentType();
		if (ccl.isPrimitive()) {
			array.write(this);
		} else {
			var len = array.length;
			new Integer(len).write(this);
			for (var i = 0; i < len; i++) {
				writeObject0(objs[i], false);
			}
		}
	}

	this.writeObject = function(obj) {
		this.writeObject0(obj, false);
	}

	this.writeObject0 = function(obj, unshared) {
		var obm = this.setBlockMode(false);
		this.depth++;
		try {
			if (obj instanceof Null) {
				this.writeNull();
				return;
			} else if (!unshared && (h = this.handles.lookup(obj)) != -1) {
				this.writeHandle(h);
				return;
			} else if (obj instanceof Class) {
				this.writeClass(obj, unshared);
				return;
			} else if (obj instanceof ObjectStreamClass) {
				this.writeClassDesc(obj, unshared);
				return;
			}

			// writeReplace

			if (obj instanceof String) {
				this.writeString(obj.val, unshared);
			} else if (obj instanceof Array) {
				this.writeArray(obj, obj.clazz, unshared);
			} else if (obj instanceof Enum) {
				this.writeEnum(obj, obj.clazz, unshared);
			} else {
				this.writeOrdinaryObject(obj, obj.clazz, unshared);
			}
		} finally {
			this.depth--;
			this.setBlockMode(obm);
		}
	}

	this.writeOrdinaryObject = function(obj, desc, unshared) {
		this.writeByte(TC_OBJECT);
		this.writeClassDesc(desc, false);
		this.handles.assign(unshared ? null : obj);
		if ('writeExternal' in desc && !desc.proxy) {
			this.writeExternalData(obj, desc);
		} else {
			this.writeSerialData(obj, desc);
		}
	}

	this.writeSerialData = function(obj, desc) {
		var slots = desc.getClassDataLayout();
		for (var i = 0; i < slots.length; i++) {
			var slotDesc = slots[i];
			if ('writeObject' in slotDesc) {
				this.setBlockMode(true);
				slotDesc.writeObject(this, obj, desc);
				this.setBlockMode(false);
				out.writeByte(TC_ENDBLOCKDATA);
			} else {
				this.defaultWriteFields(obj, slotDesc);
			}
		}
	}

	this.writeExternalData = function(obj, desc) {
		if (this.protocol == 1) {
			desc.writeExternal(this, obj);
		} else {
			this.setBlockMode(true);
			this.setBlockMode(false);
			out.writeByte(TC_ENDBLOCKDATA);
		}
	}

	this.writeFatalException = function(ex) {
		clear();
		var oldMode = this.setBlockMode(false);
		try {
			this.writeByte(TC_EXCEPTION);
			this.writeObject0(ex, false);
			clear();
		} finally {
			this.setBlockMode(oldMode);
		}
	}
	
	this.defaultWriteObject = function(obj, desc) {
        this.setBlockMode(false);
        this.defaultWriteFields(obj, desc);
        this.setBlockMode(true);
	}

	this.defaultWriteFields = function(obj, desc) {
		var cl = desc.clazz;
		if (cl != null && obj != null && !cl.isInstance(obj)) {
			throw new ClassCastException();
		}

		
		desc.writePrimitives(this,obj.values);
		var objVals = desc.getObjectFieldDescriptors(obj);
		for (var i = 0; i < objVals.length; i++) {
			var fdesc = objVals[i];
			if ( fdesc.name in obj.values ) {
				this.writeObject0(obj.values[fdesc.name], fdesc.unshared);
			} else {
				this.writeObject0(new Null(), fdesc.unshared);
			}
		}
	}

	this.writeTypeString = function(type) {
		if (type == null) {
			this.writeNull();
		} else if ((handle = this.handles.lookup(type)) != -1) {
			this.writeHandle(handle);
		} else {
			this.writeString(type, false);
		}
	}
}
