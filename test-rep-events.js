// Quick test for representationEvents.js
const { sha256HexSync } = require('./python/contracts_v1/representationEvents.js');

const hash = sha256HexSync('abc');
console.log('SHA-256 test:', hash === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' ? 'PASS' : 'FAIL');
