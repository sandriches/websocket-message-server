const io = require('socket.io-client');
const socketUrl = 'http://localhost:8085';
const options = {  
	transports: ['websocket'],
	'force new connection': true
  };
const express = require('express');
const request = require('supertest');

function createApp() {
	app = express();

	var router = express.Router();
	router.route('/').get(function(req, res) {
		return res.json({test: 'value'});
	});
	app.use(router);

	return app;
}

describe('Websocket server', function() {

	this.timeout(5000);

	var client;

	it('Create a message with a client', function(done) {
		client = io.connect(socketUrl, options);

		client.emit('new message', 'test', 'value');

		var app;
		app = createApp();

		request(app)
		.get('/')
		.query({ key: 'test' })
		.expect(200, done);
	});

});