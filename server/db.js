const { MongoClient } = require('mongodb');

const COLLECTION = 'messages';

// Connect once at startup and reuse the client for every request.
// Fails fast (rejects) if MongoDB cannot be reached.
async function connect({ url, dbName }) {
	const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
	await client.connect();
	const messages = client.db(dbName).collection(COLLECTION);
	// One document per key. Messages are stored as { key, value } rather than
	// { [key]: value } so user input never becomes a field name.
	await messages.createIndex({ key: 1 }, { unique: true });
	return { client, messages };
}

function toPublic(doc) {
	if (!doc) return null;
	return { key: doc.key, value: doc.value, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

function createRepository(messages) {
	return {
		// Insert the message, or replace the value if the key already exists.
		async upsert(key, value) {
			const now = new Date();
			const doc = await messages.findOneAndUpdate(
				{ key },
				{ $set: { value, updatedAt: now }, $setOnInsert: { createdAt: now } },
				{ upsert: true, returnDocument: 'after' },
			);
			return toPublic(doc);
		},

		async findByKey(key) {
			return toPublic(await messages.findOne({ key }));
		},

		// Newest first.
		async list() {
			const docs = await messages.find({}).sort({ updatedAt: -1 }).toArray();
			return docs.map(toPublic);
		},

		// Resolves true if a message was removed, false if the key did not exist.
		async remove(key) {
			const { deletedCount } = await messages.deleteOne({ key });
			return deletedCount === 1;
		},
	};
}

module.exports = { connect, createRepository };
