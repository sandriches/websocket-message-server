const socket = io('ws://localhost:8085');

document.getElementById('submit').onclick = () => {

    const key = document.getElementById('key').value;
	const value = document.getElementById('value').value;
	const sanitize_string = /^[0-9a-zA-Z]/
	if (key.match(sanitize_string) && value.match(sanitize_string)) {
		socket.emit('new message', key, value);
	}    
}
