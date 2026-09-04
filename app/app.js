// Served by the Express server, so the socket connects to the same origin.
const socket = io();

const form = document.getElementById('message-form');
const keyInput = document.getElementById('key');
const valueInput = document.getElementById('value');
const submitButton = document.getElementById('submit');
const statusEl = document.getElementById('status');
const tableEl = document.getElementById('messages-table');
const tbodyEl = document.getElementById('messages');
const emptyEl = document.getElementById('empty');

// Mirrors server/validate.js. The server is the source of truth; this just
// gives the user immediate feedback.
const ALPHANUMERIC = /^[0-9a-zA-Z]+$/;

// key -> message, kept in sync via the initial fetch and server broadcasts.
const messages = new Map();

function setStatus(text, kind = '') {
	statusEl.textContent = text;
	statusEl.className = kind;
}

function formatTime(iso) {
	return new Date(iso).toLocaleString();
}

function render() {
	const sorted = [...messages.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
	tbodyEl.replaceChildren(
		...sorted.map((message) => {
			const row = document.createElement('tr');

			const key = document.createElement('td');
			key.textContent = message.key;

			const value = document.createElement('td');
			value.className = 'value';
			value.textContent = message.value;

			const time = document.createElement('td');
			time.className = 'time';
			time.textContent = formatTime(message.updatedAt);

			const actions = document.createElement('td');
			actions.className = 'actions';
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'secondary';
			remove.textContent = 'Delete';
			remove.addEventListener('click', () => deleteMessage(message.key));
			actions.append(remove);

			row.append(key, value, time, actions);
			return row;
		}),
	);
	tableEl.hidden = sorted.length === 0;
	emptyEl.hidden = sorted.length > 0;
}

async function loadMessages() {
	try {
		const response = await fetch('/messages');
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		messages.clear();
		for (const message of await response.json()) {
			messages.set(message.key, message);
		}
		render();
	} catch (err) {
		setStatus(`Could not load messages: ${err.message}`, 'error');
	}
}

async function deleteMessage(key) {
	try {
		const response = await fetch(`/messages/${encodeURIComponent(key)}`, { method: 'DELETE' });
		if (response.status === 404) {
			// Already gone, possibly deleted by another client.
			messages.delete(key);
			render();
			return;
		}
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		setStatus(`Deleted "${key}"`, 'ok');
	} catch (err) {
		setStatus(`Could not delete "${key}": ${err.message}`, 'error');
	}
}

socket.on('connect', () => {
	setStatus('Connected', 'ok');
	loadMessages(); // also re-syncs after a reconnect
});
socket.on('disconnect', () => setStatus('Disconnected from server', 'error'));
socket.on('connect_error', () => setStatus('Cannot reach server', 'error'));

// Broadcasts from the server keep every open page in sync.
socket.on('message saved', (message) => {
	messages.set(message.key, message);
	render();
});
socket.on('message deleted', ({ key }) => {
	messages.delete(key);
	render();
});

form.addEventListener('submit', (event) => {
	// Stop the browser submitting the form and reloading the page, which
	// would tear down the socket before the message was sent.
	event.preventDefault();

	const key = keyInput.value;
	const value = valueInput.value;

	if (!ALPHANUMERIC.test(key) || !ALPHANUMERIC.test(value)) {
		setStatus('Key and value must contain only letters and digits', 'error');
		return;
	}

	submitButton.disabled = true;
	setStatus('Saving…');
	socket.timeout(5000).emit('new message', key, value, (timeoutErr, response) => {
		submitButton.disabled = false;
		if (timeoutErr) {
			setStatus('No response from server', 'error');
		} else if (!response.ok) {
			setStatus(response.error, 'error');
		} else {
			setStatus(`Saved "${response.message.key}"`, 'ok');
			form.reset();
			keyInput.focus();
		}
	});
});
