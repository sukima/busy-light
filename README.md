# Busy Light

This is a super tiny project that simply tracks the *busy* status of someone working remotely from home.

Since working from a home office, those I share a domicile with had difficulties telling when I was available to be interrupted or if I was in a Video Conference or Focusing.

With this app I was able to make a easily accessible app that I could send a web hook to to mark myself as busy or free and then others could use the app to tell if I was available or not.

It uses a 1 second polling to make sure the app is up-to-date and it is "Add to Home Screen" compatible.

## Installing

I installed this to my home network RaspberryPi.

1. Clone this project
2. Run `yarn`
3. Generate SSL keys `yarn gen-keys`
4. Start the server `yarn start`

## Technologies

I used the following techs

* [Node.js](https://nodejs.org)
* [Express.js](https://expressjs.com/) + some middleware
* [FancyPants](https://fancy-pants.js.org) (custom elements micro-library — I am the author)
* [Simple DOM](https://tritarget.org/cdn/simple-dom.js) (DOM proxy micro-library — I am the author)
* HTML5 + CSS + ES6

## License

MIT
