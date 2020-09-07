// Adds helper functions
const helpers = require('./helpers');

// Adds view functions
const views = require('./views');

// Configure environment variables
const dotenv = require('dotenv');
dotenv.config();

// For making HTTP Requests
const axios = require('axios');  

// For redis
const redis = require('redis');
const client = redis.createClient({
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD
});

const { App, ExpressReceiver } = require('@slack/bolt');

// Bolt Receiver
const pike13receiver = new ExpressReceiver({ signingSecret: process.env.SLACK_SIGNING_SECRET });

// Initializes your app with your bot token and signing secret
const app = new App({
  receiver: pike13receiver,
  token: process.env.SLACK_BOT_TOKEN
});

app.event('app_home_opened', async ({event, context}) => {
  try {
    const user = await helpers.getUser(app, process.env.SLACK_BOT_TOKEN, event.user);
    console.log(`${user.user.real_name} visted ${event.tab}`);

    if (event.tab == 'home') {
      client.hexists('pike13users', user.user.id, async (err, result) => {
        if (result) {
          console.log(`${user.user.real_name} is logged in!`);
        } else {
          console.log(`${user.user.real_name} is not logged in!`);
          const result = await views.publishLoginView(app, context.botToken, user.user.id);
        }
      });
    }
  }
  catch (error) {
    console.log(error);
  }
});

app.action('pike13verification', async ({action, ack}) => {
  await ack();
});

pike13receiver.router.get('/callback', (request, response) => {
  axios.post(`${process.env.PIKE13_CLIENT_URL}/oauth/token?`, null, { params: {
    grant_type: 'authorization_code',
    code: request.query['code'],
    redirect_uri: `${process.env.SERVER_URL}/callback`,
    client_id: process.env.PIKE13_CLIENT_ID,
    client_secret: process.env.PIKE13_CLIENT_SECRET
  }})
  .then(function (response) {
    console.log(response.data.access_token);
  })
  .catch(function (error) {
    console.log(error);
  });

  // Sends user back to Slack
  response.redirect('https://thecoderschoo-6nf7665.slack.com/app_redirect?app=A01AVTDU5GQ');
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();
