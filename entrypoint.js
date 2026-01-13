// entrypoint.js

// Import required setup files first
// IMPORTANT: Keep gesture handler first, then polyfills in order
import "react-native-gesture-handler";
import "react-native-get-random-values";
import "@ethersproject/shims";
import "./global.css";
import { Buffer } from "buffer";
global.Buffer = Buffer;
// Then import the expo router
import "expo-router/entry";
