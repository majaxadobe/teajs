var Socket = require("socket").Socket;
var Buffer = require("binary").Buffer;
var HASH = require("hash");
var BASE64 = require("base64");

var Server = function(ip, port) {
	this.setDebug(true);

	ip = ip || "127.0.0.1";
	port = port || 80;
	this._master = new Socket(Socket.PF_INET, Socket.SOCK_STREAM, Socket.IPPROTO_TCP);
	this._master.setOption(Socket.SO_REUSEADDR, true);
	this._master.bind(ip, port);
	this._master.listen();
	this._debug("listening at " + ip + ":" + port);
	
	this._applications = [];
	this._clients = {};
}

Server.prototype.setDebug = function(debug) {
	this._debug = (debug ? function(msg) {
		system.stdout("[ws] " + msg + "\n");
		system.stdout.flush();
	} : function() {});
}

/**
 * @param {object} application
 * @param {string || null} [host] When falsy, all hosts are okay
 * @param {string || null} [path] When falsy, all paths are okay
 */
Server.prototype.addApplication = function(application, host, path) {
	var a = {
		onmessage: function(client, data) {},
		onconnect: function(client, headers) {},
		ondisconnect: function(client, code, message) {},
		acceptsOrigin: function(origin) { return true; },
		chooseProtocol: function(protocols) { return false; },
		
		host: host,
		path: path
	};
	for (var p in application) { a[p] = application[p]; }	
	this._applications.push(a);
}

Server.prototype.run = function() {
	this._debug("running");
	while (1) {
		var list = [this._master];
		for (var id in this._clients) {
			list.push(this._clients[id].socket);
		}

		var changed = Socket.select(list, null, null, 1000);
		if (!changed) { continue; }
		for (var i=0;i<list.length;i++) {
			var socket = list[i];
			if (!socket) { continue; }
			this._processSocket(socket);
		}
	}
}

Server.prototype.send = function(id, data) {
	if (!(id in this._clients)) { return; }
	this._debug("["+id+"] sending to");
	
	var frame = new Frame();
	if (data instanceof Buffer) {
		frame.opcode = 0x2;
		frame.payload = data;
	} else {
		frame.opcode = 0x1;
		frame.payload = new Buffer(data, "utf-8");
	}
	var buffer = frame.toBuffer();
	this._clients[id].socket.send(buffer);
}

/**
 * @param {id} id Client ID
 * @param {null || int} code 
 * @param {null || string || Buffer} message Optional disconnect message
 */
Server.prototype.disconnect = function(id, code, message) {
	var client = this._clients[id];
	if (!client) { return; }
	
	this._debug("["+id+"] disconnecting");
	
	var frame = new Frame();
	frame.opcode = 0x8;
	if (code) {
		var len = 2;
		if (message) {
			var messageBuffer = (message instanceof Buffer ? message : new Buffer(message, "utf-8"));
			len += messageBuffer.length;
		}
		var payload = new Buffer(len);
		payload[0] = Math.floor(code / 0x100);
		payload[1] = code % 0x100;
		if (message) { messageBuffer.copy(payload, 2); }
		frame.payload = payload;
	}
	var buffer = frame.toBuffer();

	client.socket.send(buffer);
	client.socket.close();
	delete this._clients[id];

	client.app.ondisconnect(client.id, code, message);
}

Server.prototype._processSocket = function(socket) {
	if (socket == this._master) {
		socket = socket.accept();
		this._debug("new connection");
		try {
			this._handshake(socket);
		} catch (e) { /* handshake-level error */
			this._debug(e.message);
			socket.close();
		}
		return;
	}

	/* find client app */
	var client = null;
	for (var id in this._clients) {
		if (this._clients[id].socket == socket) { 
			client = this._clients[id];
			break;
		}
	}
	
	var data = this._receive(socket);

	if (!data.length) { /* remove and notify app */
		this._debug("["+ client.id + "] closed connection");
		socket.close();
		client.app.ondisconnect(client.id, 1001, "Connection was closed");
		delete this._clients[client.id];
		return;
	}
	
	/* parse and notify app */
	try {
		var offset = 0;
		while (1) {
			offset += client.frame.addData(data, offset);
			if (client.frame.state == Frame.STATE_DONE) { /* whole frame received */
				this._processFrame(client.frame, client);
				client.frame = new Frame();
			} else {
				break;
			}
		}
		
		/* FIXME zapamatovat zbylou cast dat a priste ji pouzit */
		
	} catch (e) {
		this.disconnect(id, e.code, e.message);
	}
}

Server.prototype._processFrame = function(frame, client) {
	this._debug("[" + client.id + "] frame opcode " + frame.opcode);
	switch (frame.opcode) {
		case 0x0: /* continuation */
			if (!client.payload) { throw new ProtocolError(1002, "No frame to be continued"); }
			/* FIXME merge to client.payload */
			if (frame.fin) { this._finalizeMessage(client); }
		break;
		
		case 0x1: /* utf-8 text frame */
		case 0x2: /* binary frame */
			if (client.payload) { throw new ProtocolError(1002, "Frames must not interleave"); }
			client.payload = frame.payload;
			client.payloadType = frame.opcode;
			if (frame.fin) { this._finalizeMessage(client); }
		break;

		case 0x8: /* close connection */
			var code = null;
			var message = null;
			if (client.payload) {
				if (client.payload.length < 2) { throw new ProtocolError(1002, "Non-empty close frame must include status code"); }
				code = client.payload[0] * 0x100 + client.payload[1];
				message = new Buffer(client.payload.length-2);
				message.copyFrom(client.payload, 2);
			}
			this.disconnect(client.id, code, message);
		break;
		
		case 0x9: /* ping */
			this._debug("[" + client.id + "] ping");
			var response = new Frame();
			response.opcode = 0xA;
			response.payload = frame.payload;
			client.socket.send(response.toBuffer());
		break;

		case 0xA: /* pong, noop */
		break;
		
		default: /* unknown opcode */
		break;
	}
}

Server.prototype._finalizeMessage = function(client) {
	var payload = client.payload;
	if (client.payloadType == 0x1) { 
		try {
			payload = payload.toString("utf-8"); 
		} catch (e) { /* failed to decode utf-8 */
			throw new ProtocolError(1007, e.message);
		}
	}
	client.app.onmessage(client.id, payload);
	client.payload = null;
}

Server.prototype._receive = function(socket) {
	/* FIXME */
	try {
		return socket.receive(2048);
	} catch (e) {
		return [];
	}
}

Server.prototype._handshake = function(socket) {
	var data = this._receive(socket).toString("ascii");
	var lines = data.split(/[\r\n]{1,2}/);
	
	/* parse HTTP method header */
	var r = lines.shift().match(/^get (.*) http\/1.1$/i);
	if (!r) { throw new Error("Invalid HTTP request"); }
	var path = r[1];
	
	/* parse remaining headers */
	var headers = {};
	while (lines.length) {
		var line = lines.pop();
		if (!line) { continue; }
		var r = line.match(/(.*?): (.*)/);
		if (!r) { throw new Error("Malformed HTTP header: " + line); }
		headers[r[1]] = r[2];
	}
	
	/* validate headers */
	if (
		!headers["Connection"] || 
		!headers["Upgrade"] || 
		!headers["Connection"].match(/upgrade/i) ||
		headers["Upgrade"] != "websocket"
	) { throw new Error("Not a HTTP websocket upgrade request"); }
	if (!headers["Sec-WebSocket-Key"]) { throw new Error("No handshake key specified"); }
	var version = headers["Sec-WebSocket-Version"];
	if (version != 8 && version != 13) { throw new Error("Version " + version + " not supported"); }
	
	/* find a valid receiver application */
	var app = this._findApp(path, headers);
	if (!app) {
		this._debug("no app found");
		throw new Error("No application available");
	}
	var protocol = false;
	var protocols = headers["Sec-WebSocket-Protocol"];
	if (protocols) {
		protocols = protocols.split(/, */);
		protocol = app.chooseProtocol(protocols);
		if (!protocol) { throw new Error("No suitable protocol"); }
	}
	
	/* send handshake */
	var key = HASH.sha1(headers["Sec-WebSocket-Key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
	var chars = key.split("");
	var len = chars.length/2;
	var buffer = new Buffer(len);
	while (len--) {
		buffer[len] = parseInt(chars.splice(chars.length-2).join(""), 16);
	}
	key = BASE64.encode(buffer).toString("ascii");
	
	var response = [
		"HTTP/1.1 101 Switching Protocols",
		"Upgrade: websocket",
		"Connection: Upgrade",
		"Sec-WebSocket-Accept: " + key
	];
	if (protocol) { response.push("Sec-WebSocket-Protocol: " + protocol); }
	response.push("", "");
	socket.send(response.join("\r\n"));
	
	var id = Math.random().toString().replace("0.", "");
	this._clients[id] = {
		socket: socket,
		app: app,
		id: id,
		buffer: null,
		frame: new Frame(),
		payload: null,
		payloadType: null
	}
	this._debug("[" + id + "] connected");

	app.onconnect(id, headers, protocol);
}

Server.prototype._findApp = function(path, headers) {
	var host = headers["Host"];
	var origin = headers["Sec-WebSocket-Origin"] || headers["Origin"];
	var protocol = headers["Sec-WebSocket-Protocol"];
	var protocols = (protocol ? protocol.split(/, */) : []);
	for (var i=0;i<this._applications.length;i++) {
		var app = this._applications[i];
		if (app.host && app.host != host) { continue; }
		if (app.path && app.path != path) { continue; }
		if (app.acceptsOrigin(origin)) { return app; }
	}
	return null;
}


/**
 * One WS frame
 */
var Frame = function() {
	this.opcode = null;
	this.fin = null;
	this.payload = null;
	this.payloadLength = null;
	this.mask = null;
	
	this.state = Frame.STATE_NEW;
}
Frame.STATE_NEW				= 0; /* empty */
Frame.STATE_WAIT_LENGTH		= 1; /* waiting for two length bytes */
Frame.STATE_WAIT_PAYLOAD	= 2; /* waiting for payload bytes */
Frame.STATE_DONE			= 3; /* all done */

/**
 * @returns {int} how many bytes from buffer were used
 */
Frame.prototype.addData = function(buffer, bufferOffset) {
	var offset = bufferOffset;
	
	/* parse first two bytes */
	if (this.state == Frame.STATE_NEW) {
		if (buffer.length-offset < 2) { return offset-bufferOffset; }
		this.fin = (buffer[offset] & 0x80);
		this.opcode = (buffer[offset] & 0xF);
		this.mask = (buffer[offset+1] & 0x80);
		if (!this.mask) { throw new ProtocolError(1002, "Client must mask frames"); }
		this.payloadLength = (buffer[offset+1] & 0x7F);
		if (this.payloadLength == 0x7F) { throw new ProtocolError(1009, "64-bit payload length not supported"); }
		this.state = (this.payloadLength < 126 ? Frame.STATE_WAIT_PAYLOAD : Frame.STATE_WAIT_LENGTH);
		offset += 2;
	}
	
	/* need two length bytes */
	if (this.state == Frame.STATE_WAIT_LENGTH) {
		if (buffer.length-offset < 2) { return offset-bufferOffset; }
		this.payloadLength = 0x100*buffer[offset] + buffer[offset+1];
		offset += 2;
		this.state = Frame.STATE_WAIT_PAYLOAD;
	}
	
	/* need mask + payload */
	if (this.state == Frame.STATE_WAIT_PAYLOAD) {
		var bytes = 4 + this.payloadLength; /* mask + payload */
		if (buffer.length-offset < bytes) { return offset-bufferOffset; }
		
		var maskOffset = offset;
		offset += 4;
		
		this.payload = new Buffer(this.payloadLength);
		for (var i=0;i<this.payloadLength;i++) {
			this.payload[i] = buffer[offset] ^ buffer[maskOffset + (i % 4)];
			offset++;
		}
		
		this.state = Frame.STATE_DONE;
	}
	
	return offset-bufferOffset;
}

Frame.prototype.toBuffer = function() {
	var length = (this.payload ? this.payload.length : 0);
	var dataOffset = 2;
	if (length > 125) { dataOffset += 2; } /* two bytes for size */
	
	var buffer = new Buffer(dataOffset + length);
	buffer[0] = 0x80 + this.opcode;
	
	if (length > 125) {
		buffer[1] = 126;
		buffer[2] = Math.floor(length / 0x100);
		buffer[3] = length % 0x100;
	} else {
		buffer[1] = length;
	}
	
	if (this.payload) { this.payload.copy(buffer, dataOffset); }
	return buffer;
}

var ProtocolError = function(code, message) {
	this.code = code;
	this.message = message;
}

exports.Server = Server;


/*
   1000

      1000 indicates a normal closure, meaning whatever purpose the
      connection was established for has been fulfilled.

   1001

      1001 indicates that an endpoint is "going away", such as a server
      going down, or a browser having navigated away from a page.

   1002

      1002 indicates that an endpoint is terminating the connection due
      to a protocol error.

   1003

      1003 indicates that an endpoint is terminating the connection
      because it has received a type of data it cannot accept (e.g. an
      endpoint that understands only text data MAY send this if it
      receives a binary message).

   1004

      Reserved.  The specific meaning might be defined in the future.

   1005

      1005 is a reserved value and MUST NOT be set as a status code in a
      Close control frame by an endpoint.  It is designated for use in
      applications expecting a status code to indicate that no status
      code was actually present.

   1006

      1006 is a reserved value and MUST NOT be set as a status code in a
      Close control frame by an endpoint.  It is designated for use in
      applications expecting a status code to indicate that the
      connection was closed abnormally, e.g. without sending or
      receiving a Close control frame.

   1007

      1007 indicates that an endpoint is terminating the connection
      because it has received data within a message that was not
      consistent with the type of the message (e.g., non-UTF-8 [RFC3629]
      data within a text message).

   1008

      1008 indicates that an endpoint is terminating the connection
      because it has received a message that violates its policy.  This
      is a generic status code that can be returned when there is no
      other more suitable status code (e.g. 1003 or 1009), or if there
      is a need to hide specific details about the policy.

   1009

      1009 indicates that an endpoint is terminating the connection
      because it has received a message which is too big for it to
      process.

   1010

      1010 indicates that an endpoint (client) is terminating the
      connection because it has expected the server to negotiate one or
      more extension, but the server didn't return them in the response
      message of the WebSocket handshake.  The list of extensions which
      are needed SHOULD appear in the /reason/ part of the Close frame.
      Note that this status code is not used by the server, because it
      can fail the WebSocket handshake instead.
*/