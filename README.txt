SETUP:

1. Install mongodb (brew tap mongodb/brew -y && brew install mongodb-community@4.4 -y)

2. Navigate to installed mongo directory (usually /usr/local/opt/mongodb-community@4.4/bin)
Alternatively, this location can be added to $PATH, eg:
export PATH="/usr/local/opt/mongodb-community@4.4/bin":$PATH

3. Add folder in the application for DB data, eg:
mkdir -p "~/Downloads/richard-corke-application/db"

4. Run command to start mongo database. Include path where the application has been downloaded, eg for ~/Downloads/richard-corke-application:
./mongod --dbpath "~/Downloads/richard-corke-application/db"

5. Navigate to application

6. Install dependencies:
npm install

7. (Optional) Configure the server. Copy .env.example to .env and edit as needed:
cp .env.example .env
Supported variables: PORT (default 8085), MONGO_URL (default mongodb://localhost:27017), DB_NAME (default messagesDB).
Requires Node 22.9 or newer.

8. Start websocket server:
npm start

9. Open app/index.html file in browser.


The port is set to run on 8085.
The server accepts key/value pairs from the browser over Socket.IO and stores them in the
database as { key, value, createdAt, updatedAt }. Keys are unique: sending an existing key
replaces its value. The socket event is 'new message' with arguments (key, value, ack), and
the ack callback receives { ok: true, message } or { ok: false, error }.

Stored messages can be fetched by key over HTTP:
curl "http://localhost:8085?key=hello"

Responses:
200  { "key": "hello", "value": "world", "createdAt": "...", "updatedAt": "..." }
400  { "error": "..." }   key missing or not alphanumeric
404  { "error": "..." }   no message with that key
500  { "error": "..." }   database error

Keys and values must be alphanumeric (max 64 and 1024 characters respectively).



TEST:
npm test (while mongod is running)


NOTES:

A lot of this tech (websockets, mongodb) was new to me so I spent time researching and focusing on those.
For security, I only allowed alphanumeric characters for the messages.
If I would have been able to have dedicate more time to it, here are some improvements I would make:

- Prettier front end
- Functionality for removing messages
- More thorough tests

I tried to follow best practice techniques where I could find them.

I would really appreciate feedback as I haven't had much experience setting up servers before!

Thanks :)
