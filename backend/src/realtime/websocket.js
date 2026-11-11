'use strict';

const { WebSocketServer, WebSocket } = require('ws');

module.exports = function (server) {
    const wss = new WebSocketServer({ server, path: '/ws' });

const broadcast = (type, data) => {
    const msg = JSON.stringify({
        type,
        data
    });

    for (const peer of wss.clients) {
        if (peer.readyState === WebSocket.OPEN) {
            peer.send(msg);
        }
    }
};

    return broadcast;
};
