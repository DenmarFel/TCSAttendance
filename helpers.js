function getUser(app, token, user) {
  return app.client.users.info({
    token: token,
    user: user
  })
}

module.exports = { getUser };