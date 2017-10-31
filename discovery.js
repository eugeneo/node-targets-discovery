const { newTarget } = require('internal/inspector_node_domains');
const { request } = require('http');
const { promisify } = require('util');
const WebSocket = require('ws');

const remoteTargets = new Map();
const portTargets = new Map();

class WsConnection {
  constructor(wsUrl, target, attachCallback, messageCallback,
              detachedCallback) {
    this._socket = new WebSocket(wsUrl);
    this._attachCallback = attachCallback;
    this._messageCallback = messageCallback;
    this._detachedCallback = detachedCallback;
    this._targetAttached = false;
    this._socket.on('open', this._attached.bind(this));
    this._socket.on('error', this._socketClosed.bind(this));
    this._socket.on('message', this._messageReceived.bind(this));
    this._socket.on('close', this._socketClosed.bind(this));
  }

  _attached() {
    this._targetAttached = true;
    this._attachCallback(null, false, this._sendMessage.bind(this), this._closeSocket.bind(this));
  }

  _closeSocket(callback) {
    if (!this._targetAttached)
      return;
    this._socket.close();
    this._targetAttached = false;
    callback();
  }

  _messageReceived(message) {
    this._messageCallback(message);
  }

  _sendMessage(message, callback) {
    this._socket.send(message, () => callback());
  }

  _socketClosed() {
    if (!this._targetAttached)
      return;
    this._messageCallback(null);
    this._targetAttached = true;
  }
}

class RemoteTarget {
  constructor(target) {
    this._connection = null;
    this._wsUrl = target.webSocketDebuggerUrl;
    this._callbacks = newTarget(target.type, target.title, target.url,
                               this.attach.bind(this));
  }

  attach(attachCallback, messageCallback, detachCallback) {
    if (this._connection) {
      callback('Already attached');
    } else {
      this._connection =
          new WsConnection(this._wsUrl, this, attachCallback, messageCallback,
                           detachCallback);
    }
  }

  update(target) {
    this._callbacks.updated(target.type, target.title, target.url);
  }

  destroyed() {
    this._callbacks.destroyed();
  }
}

function setTargets(port, targets) {
  const currentTargets = new Set();
  for (const target of targets) {
    currentTargets.add(target.id);
    const existing = remoteTargets.get(target.id);
    if (existing) {
      existing.update(target);
    } else {
      remoteTargets.set(target.id, new RemoteTarget(target));
    }
  }
  const oldTargets = portTargets.get(port);
  portTargets.set(port, currentTargets)
  if (oldTargets) {
    for (const id of oldTargets) {
      if (!currentTargets.has(id)) {
        const target = remoteTargets.get(id);
        remoteTargets.delete(id);
        target.destroyed();
      }
    }
  }
}

function read(port, res) {
  let buf = Buffer.alloc(0);
  res.on('data', (data) => {
    buf = Buffer.concat([buf, data]);
  });
  res.on('end', () => {
    try {
      setTargets(port, JSON.parse(buf.toString()));
    } catch (e) {
      console.error(e);
    }
  });
  res.on('error', (error) => {
    setTargets(port, []);
  });
}

function updateTargets(port) {
  try {
    const req = request({
      port, path: '/json/list'
    }, (res) => read(port, res));
    req.on('error', function(error) {
      setTargets(port, []);
    });
    req.end();
  } catch (e) {
    console.error(e);
  }
}

function poll(port) {
  setInterval(updateTargets.bind(null, port), 5000);
  updateTargets(port);
}

poll(10222);
poll(10224);

// module.exports = function(port) {
//   setInterval(updateTargets.bind(port), 1000);
// }
