// Configure environment variables
const dotenv = require('dotenv');
dotenv.config();

// For making HTTP Requests
const axios = require('axios');  

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
            "url": `${process.env.PIKE13_URL}/oauth/authorize?client_id=${process.env.PIKE13_CLIENT_ID}&response_type=code&user_id=${user_id}&redirect_uri=${process.env.SERVER_URL}/callback`,
            "style": "primary"
          }
        }
      ]
    }
  });
}

function getTodaysDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // January is 0
  const date = today.getDate();
  return `${year}-${month}-${date}`

}

async function publishAttendanceView(app, slack_token, user_id, events, visits, people, date = getTodaysDate()) {
  // console.log(JSON.stringify(events, null, 2));
  // console.log(JSON.stringify(visits, null, 2));
  // console.log(events);
  // console.log(visits);
  // console.log(people);

  let view = {
    "type": "home",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Use calendar to view sessions for that date."
        },
        "accessory": {
          "type": "datepicker",
          "initial_date": `${date}`,
          "placeholder": {
            "type": "plain_text",
            "text": "Select a date",
            "emoji": true
          }
        }
      },
      {
        "type": "divider"
      }
    ]
  }

  events.forEach((event) => {
    // const event_header = {
    //   "type": "header",
    //   "text": {
    //     "type": "plain_text",
		// 		"text": `${event.name} (${new Date(event.start_at).toLocaleTimeString()}-${new Date(event.end_at).toLocaleTimeString()})`,
    //   }
    // }
    // view.blocks.push(event_header);

    event.people.forEach(person => {
      const section = {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*${person.name}* _(${event.name} - ${new Date(event.start_at).toLocaleTimeString()}-${new Date(event.end_at).toLocaleTimeString()})_`,
        }
      }

      let section_nums = {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": "*Parent*"
          },
          {
            "type": "mrkdwn",
            "text": "*Number*"
          }
        ]
      }

      let person_providers;
      people.forEach(person_data => {
        if (person.id == person_data[0].id) { 
          person_providers = person_data[0].providers;
        }
      })

      person_providers.forEach(provider => {
        let provider_name = {
          "type": "plain_text",
          "text": `${provider.name}`
        };
        let provider_number = {
          "type": "plain_text",
          "text": (provider.phone) ? provider.phone : 'Unavailable'
        }
        section_nums.fields.push(provider_name);
        section_nums.fields.push(provider_number);
      })



      view.blocks.push(section);
      view.blocks.push(section_nums);
    });

    const divider = {
      "type": "divider"
    }
    view.blocks.push(divider);
  })
  

  app.client.views.publish({
    token: slack_token,
    user_id: user_id,
    view: view
  });
}

module.exports = { publishLoginView, publishAttendanceView };