const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io } = require('socket.io-client');
const request = require('supertest');
const { start, EVENTS } = require('../server');

const DB_NAME = 'messagesTest';

describe('websocket message server', function () {
	// Starting the in-memory MongoDB can take a while on first run.
	this.timeout(30000);

	let mongod;
	let instance;
	let baseUrl;
	const clients = [];

	before(async () => {
		mongod = await MongoMemoryServer.create();
		instance = await start({ port: 0, url: mongod.getUri(), dbName: DB_NAME });
		baseUrl = `http://localhost:${instance.port}`;
	});

	after(async () => {
		await instance.stop();
		await mongod.stop();
	});

	beforeEach(async () => {
		await instance.client.db(DB_NAME).collection('messages').deleteMany({});
	});

	afterEach(() => {
		for (const client of clients.splice(0)) client.close();
	});

	function connectClient() {
		const client = io(baseUrl, { transports: ['websocket'] });
		clients.push(client);
		return new Promise((resolve, reject) => {
			client.once('connect', () => resolve(client));
			client.once('connect_error', reject);
		});
	}

	// emit 'new message' and resolve with the ack payload
	const send = (client, key, value) =>
		new Promise((resolve) => client.emit('new message', key, value, resolve));

	const waitFor = (client, event) => new Promise((resolve) => client.once(event, resolve));

	describe("socket 'new message'", () => {
		it('stores a message and acks with it', async () => {
			const client = await connectClient();
			const ack = await send(client, 'hello', 'world');

			assert.equal(ack.ok, true);
			assert.equal(ack.message.key, 'hello');
			assert.equal(ack.message.value, 'world');
			assert.ok(ack.message.createdAt);
			assert.equal(ack.message.createdAt, ack.message.updatedAt);

			const stored = await instance.repo.findByKey('hello');
			assert.equal(stored.value, 'world');
		});

		it('replaces the value when the key already exists', async () => {
			const client = await connectClient();
			const first = await send(client, 'hello', 'one');
			const second = await send(client, 'hello', 'two');

			assert.equal(second.ok, true);
			assert.equal(second.message.value, 'two');
			assert.equal(second.message.createdAt, first.message.createdAt);
			assert.equal((await instance.repo.list()).length, 1);
		});

		it('rejects a key that is not fully alphanumeric', async () => {
			const client = await connectClient();
			const ack = await send(client, 'a<script>', 'value');
			assert.deepEqual(ack, { ok: false, error: 'key must contain only letters and digits' });
			assert.equal(await instance.repo.findByKey('a<script>'), null);
		});

		it('rejects a value that is not fully alphanumeric', async () => {
			const client = await connectClient();
			const ack = await send(client, 'key', 'has space');
			assert.deepEqual(ack, { ok: false, error: 'value must contain only letters and digits' });
		});

		it('rejects operator-like keys before they reach the database', async () => {
			const client = await connectClient();
			const ack = await send(client, '$where', 'x');
			assert.equal(ack.ok, false);
			assert.equal((await instance.repo.list()).length, 0);
		});

		it('rejects non-string and missing input', async () => {
			const client = await connectClient();
			assert.deepEqual(await send(client, { a: 1 }, 'x'), { ok: false, error: 'key is required' });
			assert.deepEqual(await send(client, 'k', undefined), { ok: false, error: 'value is required' });
		});

		it('rejects input over the length limit', async () => {
			const client = await connectClient();
			const ack = await send(client, 'a'.repeat(65), 'x');
			assert.deepEqual(ack, { ok: false, error: 'key must be at most 64 characters' });
		});

		it('does not fail when the client sends no ack callback', async () => {
			const client = await connectClient();
			client.emit('new message', 'noack', 'fine');
			await waitFor(client, EVENTS.saved);
			assert.equal((await instance.repo.findByKey('noack')).value, 'fine');
		});

		it("broadcasts 'message saved' to every connected client", async () => {
			const [sender, other] = await Promise.all([connectClient(), connectClient()]);
			const received = waitFor(other, EVENTS.saved);
			await send(sender, 'shared', 'data');
			const message = await received;
			assert.equal(message.key, 'shared');
			assert.equal(message.value, 'data');
		});
	});

	describe('GET /messages/:key', () => {
		it('returns the stored message', async () => {
			await instance.repo.upsert('hello', 'world');
			const res = await request(baseUrl).get('/messages/hello').expect(200);
			assert.equal(res.body.key, 'hello');
			assert.equal(res.body.value, 'world');
			assert.ok(res.body.createdAt);
			assert.equal(res.body._id, undefined);
		});

		it('returns 404 for an unknown key', async () => {
			const res = await request(baseUrl).get('/messages/missing').expect(404);
			assert.match(res.body.error, /missing/);
		});

		it('returns 400 for an invalid key', async () => {
			const res = await request(baseUrl).get('/messages/bad.key').expect(400);
			assert.equal(res.body.error, 'key must contain only letters and digits');
		});
	});

	describe('GET /?key= (original lookup URL)', () => {
		it('returns the stored message', async () => {
			await instance.repo.upsert('hello', 'world');
			const res = await request(baseUrl).get('/').query({ key: 'hello' }).expect(200);
			assert.equal(res.body.value, 'world');
		});

		it('returns 404 for an unknown key', async () => {
			await request(baseUrl).get('/').query({ key: 'missing' }).expect(404);
		});

		it('returns 400 for an invalid or repeated key', async () => {
			await request(baseUrl).get('/').query({ key: 'bad key' }).expect(400);
			await request(baseUrl).get('/?key=a&key=b').expect(400);
		});
	});

	describe('GET /messages', () => {
		it('returns an empty list when nothing is stored', async () => {
			const res = await request(baseUrl).get('/messages').expect(200);
			assert.deepEqual(res.body, []);
		});

		it('lists all messages, most recently updated first', async () => {
			await instance.repo.upsert('first', '1');
			await instance.repo.upsert('second', '2');
			await instance.repo.upsert('first', '3');
			const res = await request(baseUrl).get('/messages').expect(200);
			assert.deepEqual(
				res.body.map((m) => [m.key, m.value]),
				[
					['first', '3'],
					['second', '2'],
				],
			);
		});
	});

	describe('DELETE /messages/:key', () => {
		it("removes the message and broadcasts 'message deleted'", async () => {
			await instance.repo.upsert('hello', 'world');
			const client = await connectClient();
			const deleted = waitFor(client, EVENTS.deleted);

			await request(baseUrl).delete('/messages/hello').expect(204);

			assert.deepEqual(await deleted, { key: 'hello' });
			assert.equal(await instance.repo.findByKey('hello'), null);
		});

		it('returns 404 for an unknown key', async () => {
			await request(baseUrl).delete('/messages/missing').expect(404);
		});

		it('returns 400 for an invalid key', async () => {
			await request(baseUrl).delete('/messages/bad.key').expect(400);
		});
	});

	describe('static frontend', () => {
		it('serves index.html at /', async () => {
			const res = await request(baseUrl).get('/').expect(200);
			assert.match(res.headers['content-type'], /text\/html/);
			assert.match(res.text, /<form id="message-form"/);
		});

		it('serves the Socket.IO client', async () => {
			await request(baseUrl).get('/socket.io/socket.io.js').expect(200);
		});
	});
});
