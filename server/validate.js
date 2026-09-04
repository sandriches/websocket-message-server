// Only alphanumeric keys and values are accepted, matching the original design.
// The pattern is anchored at both ends so the whole string is checked, not just
// the first character.
const ALPHANUMERIC = /^[0-9a-zA-Z]+$/;
const MAX_KEY_LENGTH = 64;
const MAX_VALUE_LENGTH = 1024;

function validate(name, input, maxLength) {
	if (typeof input !== 'string' || input.length === 0) {
		return `${name} is required`;
	}
	if (input.length > maxLength) {
		return `${name} must be at most ${maxLength} characters`;
	}
	if (!ALPHANUMERIC.test(input)) {
		return `${name} must contain only letters and digits`;
	}
	return null;
}

const validateKey = (key) => validate('key', key, MAX_KEY_LENGTH);
const validateValue = (value) => validate('value', value, MAX_VALUE_LENGTH);

module.exports = { ALPHANUMERIC, MAX_KEY_LENGTH, MAX_VALUE_LENGTH, validateKey, validateValue };
