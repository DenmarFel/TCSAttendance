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
              "text": "Pike13 Verification"
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

function formatTime(time) {
  let pos = 0
  for (let i = 0; i < time.length; i++ ) { if (time[i] == ':') { pos = i; }}
  return time.substring(0, pos).concat(time.substring(pos + 4, time.length).toLowerCase())
}

async function publishAttendanceView(app, slack_token, user_id, events, visits, people, date = getTodaysDate()) {
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
          "action_id": "attendance_on_date",
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

  if (events.length == 0) {
    let no_events = {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*No sessions (so far).* Enjoy your day off!`,
      }
    }
    view.blocks.push(no_events);
  } else {
    events.forEach((event) => {
      let start = formatTime(new Date(event.start_at).toLocaleTimeString());
      let end = formatTime(new Date(event.end_at).toLocaleTimeString());

      const event_header = {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*<${process.env.PIKE13_URL}/e/${event.id}|${event.name} (${start}-${end})>*`,
        }
      }
      view.blocks.push(event_header);

      event.people.forEach(person => {
        let person_providers;
        people.forEach(person_data => {
          if (person.id == person_data[0].id) { 
            person_providers = person_data[0].providers;
          }
        })

        let contacts = [];
        person_providers.forEach(provider => {
          if (provider.phone) {
            contacts.push(`${provider.name} (${provider.phone.substring(0,3)}) ${provider.phone.substring(3,6)}-${provider.phone.substring(6,10)}`)
          } else {
            constats.push(`${provider.name} _(Unavailable)_`)
          }
        }) 

        const student = {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `>*Student:* ${person.name}\n>*Guardian:* ${contacts.join(', ')}`,
          }
        }
        view.blocks.push(student);

        let person_visit;
        visits.forEach(visit => {
          visit.forEach(individual_visit => {
            if (person.id == individual_visit.person_id && event.id == individual_visit.event_occurrence_id) {
              person_visit = individual_visit;
            }
          })
        })
        
        if (person_visit.completed_at == null && person_visit.noshow_at == null) {
          buttons = {
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "Present"
                },
                "style": "primary",
                "action_id": "student_present",
                "value": `${person_visit.id}/${person_visit.person_id}/${date}`
              },
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "No Show"
                },
                "action_id": "student_no_show",
                "value": `${person_visit.id}/${person_visit.person_id}/${date}`
              }
            ]
          }
        } else {
          buttons = {
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "Reset Attendance"
                },
                "style": "danger",
                "action_id": "student_reset",
                "value": `${person_visit.id}/${person_visit.person_id}/${date}`
              }
            ]
          }
        }
        
        view.blocks.push(buttons);
      });

      const divider = {
        "type": "divider"
      }
      view.blocks.push(divider);
    })
  }
  
  app.client.views.publish({
    token: slack_token,
    user_id: user_id,
    view: view
  });
}

module.exports = { publishLoginView, publishAttendanceView };