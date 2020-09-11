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
        let people_promises = []
        events.forEach(event => {
          // API Call to grab visit of each event occurrence
          let visit_request = axios.get(`${process.env.PIKE13_URL}/api/v2/desk/event_occurrences/${event.id}/visits`, { params: {
            access_token: access_token,
          }})
          visit_promises.push(visit_request)

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

          Promise.all(people_promises).then(values => {
            let people = []
            values.forEach(value => {
              people.push(value.data.people);
            })

            let date = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`
            views.publishAttendanceView(app, bot_token, user_id, events, visits, people, date);
          })
        })
      })
      .catch(error => {
        console.log(error);
      });
    });
  })
}

module.exports = { getUser, getAuthCode, storePikeCredentials, getAttendanceViewDataAndPublishView };