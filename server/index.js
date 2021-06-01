const express = require('express');
const app = express();
const server = require('http').createServer(app);
const sanitize_string = /^[0-9a-zA-Z]/
const io = require('socket.io')(server, {
	cors: {
		origin: "*",
		methods: ["GET"]
	}
});
const port = process.env.PORT || 8085;
const MongoClient = require('mongodb').MongoClient
const url = "mongodb://localhost:27017";

server.listen(port, () => {
	console.log('Server listening at port %d', port);
  });

io.on('connection', (socket) => {
	console.log('a user connected');

	socket.on('new message', (key, value) => {
		var messageObject = {};
		messageObject[key] = value;
		MongoClient.connect(url, {useUnifiedTopology: true}, function(err, db) {
			if (err) {
				return console.log(err);
			}
			var dbo = db.db('messagesDB');
			dbo.collection('messages').insertOne(messageObject, function(err, res) {
				if (err) {
					console.log("Error inserting object into database");
					return console.log(err);
				}
				console.log("Message inserted.");
				db.close();
			});
		});
	});
})

app.get('/', function(req, res) {
	if (!req.query || !req.query.key || !req.query.key.match(sanitize_string)) {
		res.status(400);
		res.send("Bad request. Use GET request with KEY='key', VALUE={message_key}, only alphanumeric values for value.");
		return;
	}
	MongoClient.connect(url, {useUnifiedTopology: true}, function(err, db) {
		if (err) {
			return console.log(err);
		}
		var dbo = db.db('messagesDB');
		const queryKey = req.query.key;
		var query = { [queryKey]: {$exists: true} };
		dbo.collection('messages').findOne(query, function(err, result) {
			if (err) {
				res.status(400);
				res.send("Database query error");
				console.log(err);
			}
			if (!result) {
				res.status(422);
				res.send("Error finding object in database");
				console.log("Error finding object in database");
			} else {
				res.status(200);
				res.send(result);
				console.log(result);
			}
			db.close();
		})
	})
})