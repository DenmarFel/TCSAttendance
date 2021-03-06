// Adds view functions
const views = require('./views');

// Configure environment variables
const dotenv = require('dotenv');
dotenv.config();

// For making HTTP Requests
const axios = require('axios');  

function getUser(app, token, user) {
  return app.client.users.info({
    token: token,
    user: user
  })
}

function getAuthCode(client, user_id) {
  return client.hget('pike13users', user_id, (error, auth_code) => {
    if (error) throw error;
    return auth_code;
  })
}

function storePikeCredentials(request, client, user_id, user) {
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
      const staff_member = response.data.staff_members.filter(s => s.email == user.user.profile.email)[0];
      client.hset('pike13staff_id', [user_id, staff_member.id])
    })
  })
  .catch(error => {
    console.log(error);
  });
}

function getAttendanceViewDataAndPublishView(client, app, bot_token, user_id, start = new Date(new Date().setHours(0,0,0,0)), end = new Date(new Date().setHours(23,59,59,999))) {
  // Grabs Pike13 access_token
  client.hget('pike13users', user_id , (error, access_token) => {
    if (error) throw error;

    // Grabs Pike13 staff_id
    client.hget('pike13staff_id', user_id, (error, staff_id) => {
      if (error) throw error;

      // API Call to grab all event occurrences
      axios.get(`${process.env.PIKE13_URL}/api/v2/desk/event_occurrences?`, { params: {
        access_token: access_token,
        staff_member_ids: staff_id,
        from: start,
        to: end
      }})
      .then(response => {

        // Grabs events from JSON response
        let events = response.data.event_occurrences;
        
        // Sorts events based on start time
        events.sort((a, b) => {
          return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
        });
  
        let visit_promises = [];
        let note_promises = [];
        let people_promises = []
        events.forEach(event => {
          // API Call to grab visit of each event occurrence
          let visit_request = axios.get(`${process.env.PIKE13_URL}/api/v2/desk/event_occurrences/${event.id}/visits`, { params: {
            access_token: access_token,
          }})
          visit_promises.push(visit_request);

          let note_request = axios.get(`${process.env.PIKE13_URL}/api/v2/desk/event_occurrences/${event.id}/notes`, { params: {
            access_token: access_token,
          }})
          note_promises.push(note_request);

          event.people.forEach(person => {
            // API Call to grab person of each person from each event
            let person_request = axios.get(`${process.env.PIKE13_URL}/api/v2/desk/people/${person.id}`, { params: {
              access_token: access_token,
            }})
            people_promises.push(person_request);
          })
        })

        Promise.all(visit_promises).then(values => {
          let visits = []
          values.forEach(value => {
            visits.push(value.data.visits);
          })

          Promise.all(note_promises).then(values => {
            let notes = [];
            values.forEach(value => {
              value.data.notes.forEach(note => {
                if (note.public == false) {
                  notes.push(note);
                }
              })
            })

            Promise.all(people_promises).then(values => {
              let people = [];
              values.forEach(value => {
                people.push(value.data.people);
              })
  
              // Converts date to YYYY-MM-DD format
              let date = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`
              views.publishAttendanceView(app, bot_token, user_id, events, visits, people, notes, date);
            })
          })
        })
      })
      .catch(error => {
        console.log(error);
      });
    });
  })
}

function updateStudentAttendance(app, client, body, context, user, state_event) {
  const visitIdAndPersonIdAndDate = body.actions[0].value.split('/');
  const visit_id = visitIdAndPersonIdAndDate[0];
  const person_id = visitIdAndPersonIdAndDate[1];
  const date = visitIdAndPersonIdAndDate[2];

  let start = new Date(date);
  start.setHours(7,0,0,0);
  start.setDate(start.getDate());
  start = new Date(start);
  let end = new Date(date);
  end.setHours(6,59,59,999);
  end.setDate(end.getDate() + 1);
  end = new Date(end);

  client.hget('pike13users', user.user.id , (error, access_token) => {
    if (error) throw error;
    axios.put(`${process.env.PIKE13_URL}/api/v2/desk/visits/${visit_id}`, {
      access_token: access_token,
      visit : {
        person_id: person_id,
        state_event: state_event
      }
    })
    .then(response => {
      getAttendanceViewDataAndPublishView(client, app, context.botToken, user.user.id, start, end);
    })
    .catch(error => {
      console.log(JSON.stringify(error, null, 2));
    })
  })
}

module.exports = { getUser, getAuthCode, storePikeCredentials, getAttendanceViewDataAndPublishView, updateStudentAttendance};