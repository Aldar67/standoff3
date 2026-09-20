#!/usr/bin/env python3
# ===== Standoff 3 -- LAN relay server =====
# Pure-stdlib WebSocket broadcast relay (no external dependencies required).
#
# It understands nothing about the game itself. Routing rule:
#   - the first connection to send {"t":"hostclaim"} becomes THE HOST for this session
#   - any message sent BY the host is broadcast to every OTHER connected client
#   - any message sent by a non-host client is forwarded ONLY to the host
# This is exactly what a host-authoritative game needs: clients talk only to the host,
# and the host's snapshots/events reach everyone else.
#
# Usage:  python server.py [port]        (default port 8766)

import base64
import hashlib
import json
import socket
import struct
import sys
import threading
import time

WS_GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def encode_frame(data, opcode=0x1):
    fin_opcode = 0x80 | opcode
    length = len(data)
    if length < 126:
        header = struct.pack('!BB', fin_opcode, length)
    elif length < 65536:
        header = struct.pack('!BBH', fin_opcode, 126, length)
    else:
        header = struct.pack('!BBQ', fin_opcode, 127, length)
    return header + data


def try_parse_frame(buf):
    if len(buf) < 2:
        return None
    b0, b1 = buf[0], buf[1]
    opcode = b0 & 0x0F
    masked = b1 & 0x80
    plen = b1 & 0x7F
    idx = 2
    if plen == 126:
        if len(buf) < idx + 2:
            return None
        plen = struct.unpack('!H', buf[idx:idx + 2])[0]
        idx += 2
    elif plen == 127:
        if len(buf) < idx + 8:
            return None
        plen = struct.unpack('!Q', buf[idx:idx + 8])[0]
        idx += 8
    mask = None
    if masked:
        if len(buf) < idx + 4:
            return None
        mask = buf[idx:idx + 4]
        idx += 4
    if len(buf) < idx + plen:
        return None
    payload = buf[idx:idx + plen]
    if mask:
        payload = bytes(payload[i] ^ mask[i % 4] for i in range(len(payload)))
    rest = buf[idx + plen:]
    return opcode, payload, rest


class State:
    def __init__(self):
        self.lock = threading.Lock()
        self.clients = {}
        self.names = {}
        self.host_id = None
        self._next = 1

    def next_id(self):
        with self.lock:
            i = self._next
            self._next += 1
            return i

    def add(self, cid, conn):
        with self.lock:
            self.clients[cid] = conn

    def remove(self, cid, conn):
        if cid is None:
            return
        was_host = False
        with self.lock:
            self.clients.pop(cid, None)
            name = self.names.pop(cid, '?')
            if self.host_id == cid:
                self.host_id = None
                was_host = True
        try:
            conn.close()
        except Exception:
            pass
        if was_host:
            self.broadcast_all({"t": "sys", "event": "hostleft"})
            print("[server] host (id=%d, %s) disconnected -- session ended" % (cid, name))
        else:
            self.send_to_host({"t": "sys", "event": "leave", "id": cid})
            print("[server] client %d (%s) disconnected" % (cid, name))

    def route(self, cid, msg):
        t = msg.get('t')
        if t == 'hostclaim':
            claimed = False
            with self.lock:
                if self.host_id is None:
                    self.host_id = cid
                    claimed = True
            if claimed:
                self.names[cid] = msg.get('name', '?')
                print("[server] client %d (%s) is now HOST" % (cid, self.names[cid]))
                self.broadcast_all({"t": "sys", "event": "hostset", "id": cid})
            else:
                self.send_to(cid, {"t": "sys", "event": "hostset", "id": self.host_id})
            return
        if t == 'hello':
            self.names[cid] = msg.get('name', '?')
        with self.lock:
            hid = self.host_id
        if cid == hid:
            self.broadcast_all(msg, exclude=cid)
        elif hid is not None:
            msg['_from'] = cid  # stamp sender id so the host knows who this came from
            self.send_to(hid, msg)
        # else: no host yet -- drop silently

    def broadcast_all(self, msg, exclude=None):
        data = encode_frame(json.dumps(msg, ensure_ascii=False).encode('utf-8'))
        with self.lock:
            targets = [c for i, c in self.clients.items() if i != exclude]
        for c in targets:
            try:
                c.sendall(data)
            except Exception:
                pass

    def send_to(self, cid, msg):
        with self.lock:
            c = self.clients.get(cid)
        if not c:
            return
        data = encode_frame(json.dumps(msg, ensure_ascii=False).encode('utf-8'))
        try:
            c.sendall(data)
        except Exception:
            pass

    def send_to_host(self, msg):
        with self.lock:
            hid = self.host_id
        if hid:
            self.send_to(hid, msg)


def send_json(conn, obj):
    conn.sendall(encode_frame(json.dumps(obj, ensure_ascii=False).encode('utf-8')))


def handle_client(conn, addr, state):
    conn.settimeout(90)
    cid = None
    try:
        data = b''
        while b'\r\n\r\n' not in data:
            chunk = conn.recv(4096)
            if not chunk:
                return
            data += chunk
            if len(data) > 65536:
                return
        headers_raw, _, rest = data.partition(b'\r\n\r\n')
        headers = {}
        for line in headers_raw.split(b'\r\n')[1:]:
            if b':' in line:
                k, v = line.split(b':', 1)
                headers[k.strip().lower()] = v.strip()
        key = headers.get(b'sec-websocket-key')
        if not key:
            try:
                conn.sendall(b"HTTP/1.1 400 Bad Request\r\n\r\nThis is the Standoff 3 WebSocket relay, not a web page.")
            except Exception:
                pass
            return
        accept = base64.b64encode(hashlib.sha1(key + WS_GUID).digest()).decode()
        resp = ("HTTP/1.1 101 Switching Protocols\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                "Sec-WebSocket-Accept: %s\r\n\r\n") % accept
        conn.sendall(resp.encode())
        cid = state.next_id()
        state.add(cid, conn)
        print("[server] %s connected as id=%d" % (addr[0], cid))
        send_json(conn, {"t": "welcome", "id": cid})
        with state.lock:
            current_host = state.host_id
        if current_host is not None:
            send_json(conn, {"t": "sys", "event": "hostset", "id": current_host})
        buf = rest
        conn.settimeout(120)
        while True:
            parsed = try_parse_frame(buf)
            while parsed is None:
                chunk = conn.recv(65536)
                if not chunk:
                    raise ConnectionError('closed')
                buf += chunk
                parsed = try_parse_frame(buf)
            opcode, payload, buf = parsed
            if opcode == 0x8:
                raise ConnectionError('close frame')
            elif opcode == 0x9:
                try:
                    conn.sendall(encode_frame(payload, opcode=0xA))
                except Exception:
                    pass
            elif opcode == 0xA:
                pass
            elif opcode == 0x1:
                try:
                    msg = json.loads(payload.decode('utf-8'))
                except Exception:
                    continue
                if isinstance(msg, dict):
                    state.route(cid, msg)
    except Exception:
        pass
    finally:
        if cid is not None:
            state.remove(cid, conn)
        else:
            try:
                conn.close()
            except Exception:
                pass


def local_ips():
    ips = set()
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith('127.'):
                ips.add(ip)
    except Exception:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    return sorted(ips)


def main():
    port = 8766
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    state = State()
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(('0.0.0.0', port))
    srv.listen(32)
    print("=" * 60)
    print("Standoff 3 -- сетевой сервер (релей) запущен")
    print("Порт: %d" % port)
    ips = local_ips()
    if ips:
        print("Адреса в локальной сети:")
        for ip in ips:
            print("  %s:%d" % (ip, port))
    print("Не закрывайте это окно, пока идёт игра по сети.")
    print("=" * 60)
    while True:
        try:
            conn, addr = srv.accept()
        except KeyboardInterrupt:
            break
        threading.Thread(target=handle_client, args=(conn, addr, state), daemon=True).start()


if __name__ == '__main__':
    main()
