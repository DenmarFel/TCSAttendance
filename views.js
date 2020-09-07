// Configure environment variables
const dotenv = require('dotenv');
dotenv.config();

function publishLoginView(app, token, user_id) {
  app.client.views.publish({
    token: token,
    user_id: user_id,
    view: {
      "type": "home",
      "blocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "You are not signed in! Please login to Pike13."
          },
          "accessory": {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "Pike13 Verification",
              "emoji": true
            },
            "action_id": "pike13verification",
            "url": `${process.env.PIKE13_URL}/oauth/authorize?client_id=${process.env.PIKE13_CLIENT_ID}&response_type=code&redirect_uri=${process.env.SERVER_URL}/callback`,
            "style": "primary"
          }
        }
      ]
    }
  });
}

module.exports = { publishLoginView };