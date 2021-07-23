const parseDuration = require('parse-duration');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

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

function transitionMachine(machine, state = machine.initial, event) {
  return machine.states[state].on?.[event] ?? machine.on?.[event] ?? state;
}

const now = () => new Date().getTime();
const hasExpired = (exp) => now() > exp;
const payload = () => ({
  status: statusManager.status(expiration),
  exp: expiration,
});

let expiration = 0;
let statusManager = new StatusManager();

app.use(cors());

app.post('/busy', bodyParser.json(), (req, res) => {
  let duration = parseDuration(req.body.duration || -1, 'ms');
  expiration = now() + duration;
  statusManager.activate();
  res.status(201).json(payload());
});

app.delete('/busy', (req, res) => {
  expiration = 0;
  statusManager.cancel();
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
