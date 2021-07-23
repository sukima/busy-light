const parseDuration = require('parse-duration');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000;

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

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
