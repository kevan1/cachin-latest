// entrypoint.js

// Import required setup files first.
// Keep these as require() calls so crypto installs before any Solana code loads.
require("react-native-gesture-handler");
require("react-native-get-random-values");
require("react-native-quick-crypto").install();
require("@ethersproject/shims");
require("./global.css");

global.Buffer = require("buffer").Buffer;

require("expo-router/entry");
