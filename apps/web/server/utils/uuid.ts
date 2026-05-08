export function generateUUID() {
	const hexDigits = "0123456789abcdef";
	let uuid = "";
	for (let i = 0; i < 36; i++) {
		if (i === 8 || i === 13 || i === 18 || i === 23) {
			uuid += "-";
		} else if (i === 14) {
			uuid += "4"; // The version number (4 for random UUIDs)
		} else if (i === 19) {
			uuid += hexDigits[(Math.random() * 16) | (0 & 0x3) | 0x8]; // The variant (10xx)
		} else {
			uuid += hexDigits[Math.floor(Math.random() * 16)];
		}
	}
	return uuid;
}
