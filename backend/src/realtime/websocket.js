'use strict';
const { WebSocketServer, WebSocket } = require('ws');
module.exports = function (server, auth) {
    const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
    wss.on('connection', peer => {
        let deadline = setTimeout(() => peer.close(1008, 'Authentication required'), 5000);
        deadline.unref();
        peer.on('error', () => {});
        peer.on('close', () => clearTimeout(deadline));
        peer.on('message', raw => {
            if (peer.auth) return;
            try {
                const message = JSON.parse(raw.toString());
                if (message.type !== 'auth') throw new Error('Authentication required');
                const claims = auth.verify(message.access_token);
                peer.auth = claims;
                clearTimeout(deadline);
                deadline = setTimeout(() => peer.close(1008, 'Token expired'), Math.max(0, claims.exp * 1000 - Date.now()));
                deadline.unref();
                peer.send(JSON.stringify({ type: 'auth:ready', data: { expiresAt: claims.exp * 1000 } }));
            } catch { peer.close(1008, 'Unauthorized'); }
        });
    });
    server.on('close', () => { for (const peer of wss.clients) peer.terminate(); wss.close(); });
    return (type, data) => {
        const msg = JSON.stringify({ type, data });
        for (const peer of wss.clients) {
            if (peer.readyState === WebSocket.OPEN && peer.auth && peer.auth.exp * 1000 > Date.now()) peer.send(msg);
        }
    };
};
