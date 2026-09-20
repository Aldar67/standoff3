#!/usr/bin/env python3
# ===== Standoff 3 -- LAN relay server =====
# Pure-stdlib WebSocket broadcast relay (no external dependencies required).
#
# It understands nothing about the game itself. Routing rule (per ROOM -- several groups can share one relay):
#   - the first connection to send {"t":"hostclaim","room":X} becomes THE HOST of room X
#   - any message sent BY a host is broadcast to every OTHER member of its room
#   - any message sent by a non-host member is forwarded ONLY to its room's host
#   - {"t":"rooms"} answers with the list of rooms (host name, player count, started flag)
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
    """Rooms: every connection joins a room with its first message (hostclaim / hello). Each room has at most
    one host; routing never crosses rooms, so several groups can play on one relay at the same time.
    Old clients that send no room name land in the room "default"."""
    def __init__(self):
        self.lock = threading.Lock()
        self.clients = {}    # cid -> socket
        self.names = {}      # cid -> nickname
        self.room_of = {}    # cid -> room code
        self.rooms = {}      # code -> {"host": cid|None, "members": set(cid), "started": bool}
        self._next = 1

    @staticmethod
    def room_code(msg):
        code = str(msg.get('room') or '').strip()[:32]
        return code or 'default'

    def next_id(self):
        with self.lock:
            i = self._next
            self._next += 1
            return i

    def add(self, cid, conn):
        with self.lock:
            self.clients[cid] = conn

    def _join(self, cid, code):
        # caller holds the lock
        old = self.room_of.get(cid)
        if old and old != code:
            self._leave_room(cid, old)
        room = self.rooms.setdefault(code, {"host": None, "members": set(), "started": False, "pass": ""})
        room["members"].add(cid)
        self.room_of[cid] = code
        return room

    def _leave_room(self, cid, code):
        room = self.rooms.get(code)
        if not room:
            return None
        room["members"].discard(cid)
        was_host = room["host"] == cid
        if was_host:
            room["host"] = None
            room["started"] = False
            room["pass"] = ""
        if not room["members"]:
            del self.rooms[code]
        return was_host

    def remove(self, cid, conn):
        if cid is None:
            return
        with self.lock:
            self.clients.pop(cid, None)
            name = self.names.pop(cid, '?')
            code = self.room_of.pop(cid, None)
            was_host = self._leave_room(cid, code) if code else None
            members = list(self.rooms.get(code, {}).get("members", [])) if code else []
            host = self.rooms.get(code, {}).get("host") if code else None
        try:
            conn.close()
        except Exception:
            pass
        if was_host:
            self.send_many(members, {"t": "sys", "event": "hostleft"})
            print("[server] host %s (id=%d) left room '%s'" % (name, cid, code))
        elif host is not None:
            self.send_to(host, {"t": "sys", "event": "leave", "id": cid})
            print("[server] client %d (%s) left room '%s'" % (cid, name, code))

    def route(self, cid, msg):
        t = msg.get('t')
        if t == 'hostclaim':
            self.names[cid] = msg.get('name', '?')
            code = self.room_code(msg)
            with self.lock:
                room = self._join(cid, code)
                if room["host"] is None:
                    room["host"] = cid
                    room["started"] = False
                    room["pass"] = str(msg.get('pass') or '')[:32]  # optional room password set by the host
                    claimed = True
                else:
                    claimed = False
                host = room["host"]
                members = list(room["members"])
            if claimed:
                print("[server] %s (id=%d) is HOST of room '%s'" % (self.names[cid], cid, code))
                self.send_many(members, {"t": "sys", "event": "hostset", "id": cid})
            else:
                self.send_to(cid, {"t": "sys", "event": "hostset", "id": host})  # busy: the client sees id != its own
            return
        if t == 'hello':
            self.names[cid] = msg.get('name', '?')
            code = self.room_code(msg)
            with self.lock:
                existing = self.rooms.get(code)
                if existing and existing["host"] is not None and existing["pass"] and str(msg.get('pass') or '') != existing["pass"]:
                    wrong = True
                    room = None
                else:
                    wrong = False
                    room = self._join(cid, code)
                host = room["host"] if room else None
            if wrong:
                self.send_to(cid, {"t": "sys", "event": "badpass"})
                return
            if host is not None:
                self.send_to(cid, {"t": "sys", "event": "hostset", "id": host})
                msg['_from'] = cid
                self.send_to(host, msg)
            else:
                self.send_to(cid, {"t": "sys", "event": "nohost"})
            return
        if t == 'rooms':
            with self.lock:
                lst = [{"code": c, "host": self.names.get(r["host"], '?') if r["host"] is not None else None,
                        "players": len(r["members"]), "started": r["started"], "locked": bool(r["pass"])} for c, r in self.rooms.items()]
            self.send_to(cid, {"t": "rooms", "rooms": lst})
            return
        with self.lock:
            code = self.room_of.get(cid)
            room = self.rooms.get(code) if code else None
            host = room["host"] if room else None
            members = [m for m in room["members"] if m != cid] if room else []
            if room and cid == host and t == 'ev' and msg.get('k') == 'start':
                room["started"] = True
        if room is None:
            return  # hasn't joined a room yet
        if cid == host:
            self.send_many(members, msg)
        elif host is not None:
            msg['_from'] = cid  # stamp sender id so the host knows who this came from
            self.send_to(host, msg)
        # else: room has no host yet -- drop silently

    def send_many(self, cids, msg):
        data = encode_frame(json.dumps(msg, ensure_ascii=False).encode('utf-8'))
        with self.lock:
            targets = [self.clients[i] for i in cids if i in self.clients]
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
