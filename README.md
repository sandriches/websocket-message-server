# websocket-message-server

A small key/value message store. A browser client sends key/value pairs to an
Express + Socket.IO server, which stores them in MongoDB and broadcasts changes
to every connected client. Messages can also be read and deleted over HTTP.

## Requirements

- Node.js 22.9 or newer
- MongoDB, either local or via Docker (see below)

## Setup

```sh
npm install
docker compose up -d        # starts MongoDB on localhost:27017
npm start                   # http://localhost:8085
```

Open http://localhost:8085 in one or more browser tabs. Saving or deleting a
message in one tab updates the others immediately.

If you already run MongoDB some other way, skip Docker Compose and point
`MONGO_URL` at it.

### Configuration

Copy `.env.example` to `.env` and edit as needed. `npm start` loads it
automatically.

| Variable      | Default                     | Purpose                                                |
| ------------- | --------------------------- | ------------------------------------------------------ |
| `PORT`        | `8085`                      | HTTP and websocket port                                |
| `MONGO_URL`   | `mongodb://localhost:27017` | MongoDB connection string                              |
| `DB_NAME`     | `messagesDB`                | Database name                                          |
| `CORS_ORIGIN` | unset                       | Allow socket connections from another origin, e.g. `*` |

The server exits with a non-zero status if MongoDB cannot be reached at startup.

## API

Messages are stored as `{ key, value, createdAt, updatedAt }`. Keys are unique:
saving an existing key replaces its value. Keys and values must be alphanumeric,
with a maximum of 64 and 1024 characters respectively.

### Socket.IO

Connect to the server origin. Events:

| Direction        | Event             | Payload                                                                |
| ---------------- | ----------------- | ---------------------------------------------------------------------- |
| client to server | `new message`     | `(key, value, ack)`; ack receives `{ ok, message }` or `{ ok, error }` |
| server to all    | `message saved`   | the saved message                                                      |
| server to all    | `message deleted` | `{ key }`                                                              |

### HTTP

| Method   | Path             | Response                                                 |
| -------- | ---------------- | -------------------------------------------------------- |
| `GET`    | `/messages`      | `200` list of messages, most recently updated first      |
| `GET`    | `/messages/:key` | `200` message, `404` if missing, `400` if key is invalid |
| `GET`    | `/?key=:key`     | same as above (original lookup URL)                      |
| `DELETE` | `/messages/:key` | `204`, `404` if missing, `400` if key is invalid         |

Errors are returned as `{ "error": "..." }`. Example:

```sh
curl http://localhost:8085/messages/hello
```

## Development

```sh
npm test              # mocha, uses an in-memory MongoDB (no local Mongo needed)
npm run lint          # eslint
npm run format        # prettier
```

The first `npm install` and `npm test` are slow because `mongodb-memory-server`
downloads a MongoDB binary. It is cached afterwards.

## Layout

```
app/        static frontend served by Express
server/     index.js (HTTP + socket wiring), db.js (MongoDB access), validate.js
test/       integration tests against a real server and in-memory MongoDB
```

## Background

This started as a take-home coding exercise and has since been reworked:
consolidated dependencies, safe document shape, a single reused database
connection, proper HTTP status codes, socket acknowledgements, list and delete,
broadcasts, real integration tests, and lint/format tooling.
