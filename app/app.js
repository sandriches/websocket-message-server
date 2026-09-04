const socket = io('ws://localhost:8085');

const form = document.getElementById('message-form');
const keyInput = document.getElementById('key');
const valueInput = document.getElementById('value');
const statusEl = document.getElementById('status');

// Mirrors server/validate.js. The server is the source of truth; this just
// gives the user immediate feedback.
const ALPHANUMERIC = /^[0-9a-zA-Z]+$/;

function setStatus(text, isError = false) {
	statusEl.textContent = text;
	statusEl.style.color = isError ? 'crimson' : 'green';
}

socket.on('connect', () => setStatus('Connected'));
socket.on('disconnect', () => setStatus('Disconnected from server', true));
socket.on('connect_error', () => setStatus('Cannot reach server', true));

form.addEventListener('submit', (event) => {
	// Stop the browser submitting the form and reloading the page, which
	// would tear down the socket before the message was sent.
	event.preventDefault();

	const key = keyInput.value;
	const value = valueInput.value;

	if (!ALPHANUMERIC.test(key) || !ALPHANUMERIC.test(value)) {
		setStatus('Key and value must contain only letters and digits', true);
		return;
	}

	setStatus('Saving…');
	socket.timeout(5000).emit('new message', key, value, (timeoutErr, response) => {
		if (timeoutErr) {
			setStatus('No response from server', true);
		} else if (!response.ok) {
			setStatus(response.error, true);
		} else {
			setStatus(`Saved "${response.message.key}"`);
			form.reset();
			keyInput.focus();
		}
	});
});
