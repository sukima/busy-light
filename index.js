const parseDuration = require('parse-duration');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const discordWebhook = process.env.DISCORD_WEBHOOK;
const liveSiteUrl = process.env.LIVE_URL;
const httpPort = process.argv[2] ?? 3001;
const httpsPort = httpPort - 1;
const privateKey  = fs.readFileSync(path.join(__dirname, 'sslcert/server.key'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'sslcert/server.crt'), 'utf8');
const app = express();

class StatusManager {
  MACHINE = {
    initial: 'inactive',
    on: { ACTIVATE: 'active' },
    states: {
      inactive: {},
      active: {
        on: { CANCEL: 'cancelled', EXPIRE: 'expired' },
      },
      expired: {},
      cancelled: {},
    },
  };
  state = this.MACHINE.initial;
  transition(event) {
    this.state = transitionMachine(this.MACHINE, this.state, event);
  }
  activate() {
    this.transition('ACTIVATE');
  }
  cancel() {
    this.transition('CANCEL');
  }
  expire() {
    this.transition('CANCEL');
  }
  status(exp) {
    this.transition(hasExpired(exp) ? 'EXPIRE' : 'ACTIVATE');
    return this.state;
  }
}

class Timer {
  #timerRef;
  start(delay, cb) {
    this.stop();
    this.#timerRef = setTimeout(cb, delay);
  }
  stop() {
    clearTimeout(this.#timerRef);
  }
}

class NullNotifier {
  setBusy() {}
  clearBusy() {}
}

class BusyNotifier {
  constructor(notify, timer = new Timer()) {
    this.timer = timer;
    this.notify = notify;
  }
  setBusy(delay, { expiration, url }) {
    let content = `I am **busy** till about ${formatTime(expiration)}`;
    let embeds = [{
      title: '“Am I Busy” live tracking',
      description: 'Viewable in any browser at home only.',
      url,
    }];
    this.notify.send({ content, ...(url ? { embeds } : {}) });
    this.timer.start(delay, () => this.clearBusy());
  }
  clearBusy() {
    this.timer.stop();
    this.notify.retract();
  }
}

class DiscordNotify {
  constructor(url) {
    this.url = url;
  }
  async send(payload) {
    let url = new URL(this.url);
    url.searchParams.append('wait', true);
    console.log('sending webhook');

    try {
      let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let { id } = await res.json();
      this.messageId = id;
      console.log(`sent ${id}`);
    } catch (error) {
      console.log(error);
      this.messageId = null;
    }
  }
  async retract() {
    if (!this.messageId) return;

    let url = new URL(this.url);
    url.pathname = path.join(url.pathname, 'messages', this.messageId);
    this.messageId = null;

    try {
      await fetch(url, { method: 'DELETE' });
    } catch (error) {
      console.log(error);
    }
  }
}

function transitionMachine(machine, state = machine.initial, event) {
  return machine.states[state].on?.[event] ?? machine.on?.[event] ?? state;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { timeStyle: 'short' });
}

const now = () => new Date().getTime();
const hasExpired = (exp) => now() > exp;
const payload = () => ({
  status: statusManager.status(expiration),
  exp: expiration,
});

let expiration = 0;
let statusManager = new StatusManager();
let notifier = discordWebhook
  ? new BusyNotifier(new DiscordNotify(discordWebhook))
  : new NullNotifier();

app.use(cors());

app.post('/busy', bodyParser.json(), (req, res) => {
  let duration = parseDuration(req.body.duration || -1, 'ms');
  expiration = now() + duration;
  statusManager.activate();
  if (req.body.notify !== false)
    notifier.setBusy(duration, { expiration, url: liveSiteUrl });
  res.status(201).json(payload());
});

app.delete('/busy', (req, res) => {
  expiration = 0;
  statusManager.cancel();
  notifier.clearBusy();
  res.json(payload());
});

app.get('/busy', (req, res) => {
  res.json(payload());
});

app.use(express.static(path.join(__dirname, 'public')));

http
  .createServer(app)
  .listen(httpPort, () => { console.log(`Listening on HTTP port ${httpPort}`); });

https
  .createServer({ key: privateKey, cert: certificate }, app)
  .listen(httpsPort, () => { console.log(`Listening on HTTPS port ${httpsPort}`); });
