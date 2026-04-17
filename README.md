# Ball Merge Game

A physics-based ball merging game built with React Native, Matter.js, and Canvas 2D.

## Running with Expo Snack (fastest)

1. Go to [snack.expo.dev](https://snack.expo.dev)
2. Replace the default `App.js` with the contents of `App.js` from this repo
3. Press the Add Dependencies pop up for `react-native-webview`
4. Scan the QR code with the **Expo Go** app on your phone, or use the in-browser emulator

## Running locally

**Prerequisites:** Node.js, Expo CLI, and Expo Go on your phone

```bash
# Install dependencies
npx create-expo-app . --template blank
npx expo install react-native-webview

# Start the dev server
npx expo start
```

Then scan the QR code in the terminal with Expo Go (iOS or Android).

## How to play

- **Tap / drag** to aim, release to drop a ball
- Balls of the same tier merge into the next tier
- Chain merges quickly for combo multipliers
- Don't let balls overflow the top

## Abilities (3 uses each)

| Button | Effect |
|--------|--------|
| **SWAP** | Replace your next ball with a new random one |
| **QUAKE** | Shake all balls with a random impulse |
| **WALLS** | Extend the container walls upward for 5 seconds |
