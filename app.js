// Adds helper functions
const helpers = require('./helpers');

// Adds view functions
const views = require('./views');

// Configure environment variables
const dotenv = require('dotenv');
dotenv.config();

// For making HTTP Requests
const axios = require('axios');  

// For Redis
const redis = require('redis');
const client = redis.createClient({
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD
});

// For Bolt
const { App, ExpressReceiver } = require('@slack/bolt');
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

    let start = new Date(new Date().toLocaleString('en-US', {timeZone: "America/Los_Angeles"}));
    start.setHours(7,0,0,0);
    start.setDate(start.getDate());
    start = new Date(start);
    let end = new Date(new Date().toLocaleString('en-US', {timeZone: "America/Los_Angeles"}));
    end.setHours(6,59,59,999);
    end.setDate(end.getDate() + 1);
    end = new Date(end);

    if (event.tab == 'home') {
      // Checks if user has Pike13 login credentials
      client.hexists('pike13users', user.user.id, (error, exists) => {
        if (error) throw error;
        // Case 1: User is verified on Pike => Display attendance view
        if (exists) { helpers.getAttendanceViewDataAndPublishView(client, app, context.botToken, user.user.id, start, end); } 
        // Case 2: User is verified on Pike => Display attendance view
        else { views.publishLoginView(app, context.botToken, user.user.id); }
      });
    }
  }
  catch (error) {
    console.log(error);
  }
});

app.action('attendance_on_date', async ({action, ack, body, context}) => {
  await ack();
  try {
    const user = await helpers.getUser(app, process.env.SLACK_BOT_TOKEN, body.user.id);

    // console.log(action.selected_date);
    let start = new Date(action.selected_date);
    start.setHours(7,0,0,0);
    start.setDate(start.getDate());
    start = new Date(start);
    let end = new Date(action.selected_date);
    end.setHours(6,59,59,999);
    end.setDate(end.getDate() + 1);
    end = new Date(end);

    // Checks if user has Pike13 login credentials
    client.hexists('pike13users', user.user.id, (error, exists) => {
      if (error) throw error;
      // Case 1: User is verified on Pike => Display attendance view
      if (exists) { helpers.getAttendanceViewDataAndPublishView(client, app, context.botToken, user.user.id, start, end); } 
      // Case 2: User is not verified on Pike => Display login view
      else { views.publishLoginView(app, context.botToken, user.user.id); }
    });
  }
  catch (error) {
    console.log(error)
  }
});

app.action('student_present', async ({ack, body, context}) => {
  await ack();
  try {
    const user = await helpers.getUser(app, process.env.SLACK_BOT_TOKEN, body.user.id);
    helpers.updateStudentAttendance(app, client, body, context, user, "complete");
  }
  catch (error) {
    console.log(error);
  }
})


app.action('student_no_show', async ({ack, body, context}) => {
  await ack();
  try {
    const user = await helpers.getUser(app, process.env.SLACK_BOT_TOKEN, body.user.id);
    helpers.updateStudentAttendance(app, client, body, context, user, "noshow");
  }
  catch (error) {
    console.log(error);
  }
})

app.action('student_reset', async ({ack, body, context}) => {
  await ack();
  try {
    const user = await helpers.getUser(app, process.env.SLACK_BOT_TOKEN, body.user.id);
    helpers.updateStudentAttendance(app, client, body, context, user, "reset");
  }
  catch (error) {
    console.log(error);
  }
})

app.action('pike13verification', async ({action, ack}) => {
  await ack();
});

pike13receiver.router.get('/callback', async (request, response) => {
  const user_id = new URLSearchParams(response.req.headers.referer).get('user_id');
  const user = await helpers.getUser(app, process.env.SLACK_BOT_TOKEN, user_id);
  helpers.storePikeCredentials(request, client, user_id, user);

  // Sends user back to Slack
  response.redirect('https://thecoderschoo-6nf7665.slack.com/app_redirect?app=A01AVTDU5GQ');
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();
