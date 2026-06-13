# Pi Deployment

This folder contains a simple production setup for a Raspberry Pi host named `aura`.

The app is already production-ready as a Node server that serves the built Vite app and the Socket.IO realtime backend from the same process.

## Goal

- Serve Vibeoke on the Pi over the local network.
- Make `http://vibeoke.aura` resolve to the Pi.
- Keep the app reachable from the whole LAN.

## Build And Run

On the Pi:

```bash
npm install
npm run build
NODE_ENV=production npm start
```

If you want a custom bind address, set `HOST` and `PORT`:

```bash
HOST=0.0.0.0 PORT=3333 NODE_ENV=production npm start
```

## Local DNS

`vibeoke.aura` is not something the app can create by itself. It must be mapped in your network DNS, router, Pi-hole, or hosts file.

Recommended options:

1. Pi DNS server + router DHCP DNS
   - Install `dnsmasq` on the Pi.
   - Use `deploy/pi/dnsmasq-vibeoke.conf`.
   - Point router DHCP DNS to `192.168.254.77`.
2. Router DNS / Pi-hole local DNS record
   - Point `vibeoke.aura` to the Pi's LAN IP, for example `192.168.254.77`.
3. Hosts file on each device
   - Add `192.168.254.77 vibeoke.aura` on clients that should access the app.

## Systemd

Use the included service file to keep Vibeoke running after reboot.

```bash
sudo cp deploy/pi/vibeoke.service /etc/systemd/system/vibeoke.service
sudo systemctl daemon-reload
sudo systemctl enable --now vibeoke
```

Edit the service file first if your repo path is different.

## Reverse Proxy

nginx is the simplest option for a LAN-only setup. It listens on `vibeoke.aura` and proxies requests to the Node app on `127.0.0.1:3333`.

Copy `deploy/pi/nginx-vibeoke.conf` into `/etc/nginx/sites-available/vibeoke` and enable it with a symlink in `/etc/nginx/sites-enabled/`.

The app already serves the SPA fallback, so `/player` and `/controller` will work directly.

## DNS Service

If you use the Pi as LAN DNS, install and enable dnsmasq:

```bash
sudo apt-get install -y dnsmasq
sudo cp deploy/pi/dnsmasq-vibeoke.conf /etc/dnsmasq.d/vibeoke.conf
sudo mkdir -p /etc/systemd/system/dnsmasq.service.d
sudo cp deploy/pi/dnsmasq.service.d/override.conf /etc/systemd/system/dnsmasq.service.d/override.conf
sudo systemctl daemon-reload
sudo systemctl restart dnsmasq
```

Then set the router's DHCP DNS server to `192.168.254.77` so all devices resolve `vibeoke.aura` through the Pi.
