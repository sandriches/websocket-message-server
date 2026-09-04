const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { connect, createRepository } = require('./db');
const { validateKey, validateValue } = require('./validate');

const config = {
	port: process.env.PORT || 8085,
	url: process.env.MONGO_URL || 'mongodb://localhost:27017',
	dbName: process.env.DB_NAME || 'messagesDB',
	// The frontend is served from this server, so cross-origin socket access is
	// off by default. Set CORS_ORIGIN (e.g. "*" or "http://localhost:3000") to
	// allow a frontend hosted elsewhere.
	corsOrigin: process.env.CORS_ORIGIN || undefined,
};

const APP_DIR = path.join(__dirname, '..', 'app');

// Socket.IO events broadcast to every connected client when the store changes.
const EVENTS = {
	saved: 'message saved',
	deleted: 'message deleted',
};

// broadcast(event, payload) sends to every connected socket client.
function createApp(repo, broadcast) {
	const app = express();

	const notFound = (res, key) => res.status(404).json({ error: `No message found for key "${key}"` });

	async function getByKey(req, res) {
		const key = req.params.key ?? req.query.key;
		const error = validateKey(key);
		if (error) return res.status(400).json({ error });
		const message = await repo.findByKey(key);
		if (!message) return notFound(res, key);
		res.json(message);
	}

	// GET /messages -> [{ key, value, createdAt, updatedAt }, ...] newest first
	app.get('/messages', async (req, res) => {
		res.json(await repo.list());
	});

	// GET /messages/:key -> { key, value, createdAt, updatedAt }
	app.get('/messages/:key', getByKey);

	// GET /?key=foo is the original lookup URL and still works. Without a key
	// the request falls through to the static frontend.
	app.get('/', (req, res, next) => (req.query.key === undefined ? next() : getByKey(req, res)));

	// DELETE /messages/:key -> 204, and broadcasts 'message deleted' to clients
	app.delete('/messages/:key', async (req, res) => {
		const { key } = req.params;
		const error = validateKey(key);
		if (error) return res.status(400).json({ error });
		const removed = await repo.remove(key);
		if (!removed) return notFound(res, key);
		broadcast(EVENTS.deleted, { key });
		res.status(204).end();
	});

	app.use(express.static(APP_DIR));

	// eslint-disable-next-line no-unused-vars
	app.use((err, req, res, next) => {
		console.error(err);
		res.status(500).json({ error: 'Internal server error' });
	});

	return app;
}

function attachSocket(server, repo, { corsOrigin } = {}) {
	const io = new Server(server, corsOrigin ? { cors: { origin: corsOrigin, methods: ['GET'] } } : {});

	io.on('connection', (socket) => {
		console.log('Client connected: %s', socket.id);

		// Clients emit ('new message', key, value, ack) and receive
		// { ok: true, message } or { ok: false, error } via the ack callback.
		// On success every connected client receives 'message saved'.
		socket.on('new message', async (key, value, ack) => {
			const reply = typeof ack === 'function' ? ack : () => {};
			const error = validateKey(key) || validateValue(value);
			if (error) {
				return reply({ ok: false, error });
			}
			try {
				const message = await repo.upsert(key, value);
				io.emit(EVENTS.saved, message);
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
	// Express must be attached to the HTTP server before Socket.IO so that
	// Socket.IO can intercept /socket.io/ requests ahead of it.
	const app = createApp(repo, (event, payload) => io.emit(event, payload));
	const server = http.createServer(app);
	const io = attachSocket(server, repo, options);

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
			console.log(
				'Server listening at http://localhost:%d (MongoDB: %s/%s)',
				instance.port,
				config.url,
				config.dbName,
			);

			const shutdown = (signal) => {
				console.log('%s received, shutting down', signal);
				instance.stop().then(
					() => process.exit(0),
					(err) => {
						console.error(err);
						process.exit(1);
					},
				);
			};
			process.on('SIGINT', () => shutdown('SIGINT'));
			process.on('SIGTERM', () => shutdown('SIGTERM'));
		})
		.catch((err) => {
			console.error('Failed to start server: %s', err.message);
			process.exit(1);
		});
}

module.exports = { config, EVENTS, createApp, attachSocket, start };
