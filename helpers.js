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
    if (error) throw err;
    return auth_code;
  })
}

function getTodaysDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // January is 0
  const date = today.getDate();
  return `${year}-${month}-${date}`

}

function getAttendanceViewDataAndPublishView(client, app, bot_token, user_id, start = new Date().setHours(0,0,0,0), end = new Date().setHours(23,59,59,999)) {
  // Grabs Pike13 access_token
  client.hget('pike13users', user_id , (error, access_token) => {
    if (error) throw error;

    // Grabs Pike13 staff_id
    client.hget('pike13staff_id', user_id, (error, staff_id) => {
      if (error) throw error;

      // API Call to grab all event occurrences
      axios.get(`${process.env.PIKE13_URL}/api/v2/desk/event_occurrences?`, { params: {
        access_token: access_token,
        staff_member_ids: staff_id
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

            views.publishAttendanceView(app, bot_token, user_id, events, visits, people);
          })

          
        })
      })
      .catch(error => {
        console.log(error);
      });
    });
  })
}

module.exports = { getUser, getAuthCode, getAttendanceViewDataAndPublishView };