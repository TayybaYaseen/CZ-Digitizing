import { registerRootComponent } from 'expo';
import App from './App';

// Explicit entry point (rather than the default "node_modules/expo/AppEntry.js" main field) —
// the default's node_modules-relative path was observed producing a backslash-corrupted bundle
// URL from the Metro/Expo web dev server on Windows, causing a 404. registerRootComponent handles
// AppRegistry.registerComponent('main') and web-specific root wiring identically to AppEntry.js.
registerRootComponent(App);
