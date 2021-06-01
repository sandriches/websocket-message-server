SETUP:

1. Install mongodb (brew tap mongodb/brew -y && brew install mongodb-community@4.4 -y)

2. Navigate to installed mongo directory (usually /usr/local/opt/mongodb-community@4.4/bin)
Alternatively, this location can be added to $PATH, eg:
export PATH="/usr/local/opt/mongodb-community@4.4/bin":$PATH

3. Add folder in the application for DB data, eg:
mkdir "~/Downloads/richard-corke-application/db"

4. Run command to start mongo database. Include path where the application has been downloaded, eg for ~/Downloads/richard-corke-application:
./mongod --dbpath "~/Downloads/richard-corke-application/db"

5. Navigate to application

6. Install dependencies:
cd server
npm install -y
cd ..
npm install -y


7. Start websocket server:
npm start

8. Open index.html file in browser.


The port is set to run on 8085.
The server will accept key/value pairs from the browser and store them in the database.
An example request can be seen below:
curl "http://localhost:8085?key=hello"



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