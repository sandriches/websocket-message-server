const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { connect, createRepository } = require('./db');
const { validateKey, validateValue } = require('./validate');

const config = {
	port: process.env.PORT || 8085,
	url: process.env.MONGO_URL || 'mongodb://localhost:27017',
	dbName: process.env.DB_NAME || 'messagesDB',
};

function createApp(repo) {
	const app = express();

	// GET /?key=foo -> { key, value, createdAt, updatedAt }
	app.get('/', async (req, res, next) => {
		const { key } = req.query;
		const error = validateKey(key);
		if (error) {
			return res.status(400).json({ error });
		}
		try {
			const message = await repo.findByKey(key);
			if (!message) {
				return res.status(404).json({ error: `No message found for key "${key}"` });
			}
			res.json(message);
		} catch (err) {
			next(err);
		}
	});

	// eslint-disable-next-line no-unused-vars
	app.use((err, req, res, next) => {
		console.error(err);
		res.status(500).json({ error: 'Internal server error' });
	});

	return app;
}

function attachSocket(server, repo) {
	const io = new Server(server, {
		cors: { origin: '*', methods: ['GET'] },
	});

	io.on('connection', (socket) => {
		console.log('Client connected: %s', socket.id);

		// Clients emit ('new message', key, value, ack) and receive
		// { ok: true, message } or { ok: false, error } via the ack callback.
		socket.on('new message', async (key, value, ack) => {
			const reply = typeof ack === 'function' ? ack : () => {};
			const error = validateKey(key) || validateValue(value);
			if (error) {
				return reply({ ok: false, error });
			}
			try {
				const message = await repo.upsert(key, value);
				reply({ ok: true, message });
			} catch (err) {
				console.error('Failed to store message', err);
				reply({ ok: false, error: 'Failed to store message' });
			}
		});

		socket.on('disconnect', (reason) => {
			console.log('Client disconnected: %s (%s)', socket.id, reason);
		});
	});

	return io;
}

async function start(options = config) {
	const { client, messages } = await connect(options);
	const repo = createRepository(messages);
	const app = createApp(repo);
	const server = http.createServer(app);
	const io = attachSocket(server, repo);

	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(options.port, resolve);
	});

	async function stop() {
		io.close();
		await new Promise((resolve) => server.close(resolve));
		await client.close();
	}

	return { app, server, io, client, repo, port: server.address().port, stop };
}

if (require.main === module) {
	start(config)
		.then((instance) => {
			console.log('Server listening at port %d (MongoDB: %s/%s)', instance.port, config.url, config.dbName);

			const shutdown = (signal) => {
				console.log('%s received, shutting down', signal);
				instance.stop().then(() => process.exit(0), (err) => {
					console.error(err);
					process.exit(1);
				});
			};
			process.on('SIGINT', () => shutdown('SIGINT'));
			process.on('SIGTERM', () => shutdown('SIGTERM'));
		})
		.catch((err) => {
			console.error('Failed to start server: %s', err.message);
			process.exit(1);
		});
}

module.exports = { config, createApp, attachSocket, start };
