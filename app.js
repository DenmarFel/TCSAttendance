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
    console.log(`${user.user.real_name} visited ${event.tab}`);

    if (event.tab == 'home') {
      // Checks if user has Pike13 login credentials
      client.hexists('pike13users', user.user.id, (error, exists) => {
        if (error) throw err;
        let start = new Date();
        start.setHours(0,0,0,0);

        let end = new Date();
        end.setHours(23,59,59,999);

        console.log(start.toLocaleTimeString(), end.toLocaleTimeString());

        // Case 1: User is verified on Pike => Display attendance view
        if (exists) { helpers.getAttendanceViewDataAndPublishView(client, app, context.botToken, user.user.id); } 
        // Case 2: User is verified on Pike => Display attendance view
        else { views.publishLoginView(app, context.botToken, user.user.id); }
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

pike13receiver.router.get('/callback', async (request, response) => {
  const user_id = new URLSearchParams(response.req.headers.referer).get('user_id');
  const user = await helpers.getUser(app, process.env.SLACK_BOT_TOKEN, user_id);

  // Grabs Pike13 access_token to store in redis
  axios.post(`${process.env.PIKE13_URL}/oauth/token?`, null, { params: {
    grant_type: 'authorization_code',
    code: request.query['code'],
    redirect_uri: `${process.env.SERVER_URL}/callback`,
    client_id: process.env.PIKE13_CLIENT_ID,
    client_secret: process.env.PIKE13_CLIENT_SECRET
  }})
  .then(response => {
    const access_token = response.data.access_token;
    client.hset('pike13users', [user_id, access_token]);

    // Grabs Pike13 staff_id to store in redis
    axios.get(`${process.env.PIKE13_URL}/api/v2/desk/staff_members?`, { params: {
      access_token: access_token
    }})
    .then(response => {
      const staff_members = response.data.staff_members;
      const staff_member = staff_members.filter(s => s.email == user.user.profile.email)[0];
      client.hset('pike13staff_id', [user_id, staff_member.id])
    })
    .catch(error => {
      console.log(error);
    });  

  })
  .catch(error => {
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
