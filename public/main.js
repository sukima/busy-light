import $ from 'https://tritarget.org/cdn/simple-dom.js';
import Component from 'https://fancy-pants.js.org/min/component.js';
import { tracked } from 'https://fancy-pants.js.org/min/tracking.js';

class Poller {
  constructor(onPoll, time = 1000) {
    this.onPoll = onPoll;
    this.time = time;
  }

  async _tick() {
    await this.onPoll();
    this.start();
  }

  start() {
    this.stop();
    this._timer = setTimeout(() => this._tick(), this.time);
  }

  stop() {
    clearTimeout(this._timer);
  }
}

class TimeFormatter {
  constructor(timestamp) {
    this.timestamp = timestamp;
  }
  toString() {
    return this.timestamp
      ? new Date(this.timestamp).toLocaleTimeString([], { timeStyle: 'short' })
      : '';
  }
}

class StatusManager extends Component {
  status = tracked({});
  polling = new Poller(() => this.updateStatus());

  connectedCallback() {
    super.connectedCallback();
    this.tearDown = $(this).on.click(e => this.handleAction(e));
    this.polling.start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.polling.stop();
    this.tearDown();
  }

  handleAction({ target }) {
    let { action } = target.dataset;
    switch (action) {
      case 'activate-30m': return this.activate('30m');
      case 'activate-1h': return this.activate('1h');
      case 'activate-2h': return this.activate('2h');
      case 'cancel': return this.cancel();
      default: // no-op
    }
  }

  async sendRequest(...args) {
    let res = await fetch('/busy', ...args);
    this.status = await res.json();
    this.polling.start();
  }

  yields() {
    let { status: state, exp: experation = 0 } = this.status;
    return { state, experation };
  }

  updateStatus() {
    return this.sendRequest();
  }

  activate(duration) {
    let notify = $(this).notification.checked;
    return this.sendRequest({
      method: 'POST',
      headers: { 'Content-type': 'application/json' },
      body: JSON.stringify({ duration, notify })
    });
  }

  cancel() {
    return this.sendRequest({ method: 'DELETE' });
  }
}
StatusManager.register();

class StatusCard extends Component {
  render({ statusManager }) {
    let { state, experation } = statusManager;
    if (state) {
      this.dataset.state = state;
    }
    $(this).all['[data-ref=experation]'].elements.forEach(el => {
      el.setAttribute('datetime', experation);
      el.textContent = new TimeFormatter(experation).toString();
    });
  }
}
StatusCard.register();
