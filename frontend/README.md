# FrameLens

FrameLens is a mobile-friendly photo coaching web app. It lets you load a reference image,
place it over the live camera preview, adjust the opacity, and capture the composed photo.

## Run locally

```bash
npm install
npm run dev
```

Camera access requires HTTPS on most phones. Localhost works on a computer, but a deployed
HTTPS URL is the best way to test on a real phone.

## Install on a phone

Deploy the app to an HTTPS host, then open the URL on your phone.

### iPhone

1. Open the deployed URL in Safari.
2. Tap the Share button.
3. Choose **Add to Home Screen**.
4. Open FrameLens from the new home screen icon.

### Android

1. Open the deployed URL in Chrome.
2. Tap the `...` menu.
3. Choose **Install app** or **Add to Home screen**.
4. Open FrameLens from the new home screen icon.

## Production checks

```bash
npm run lint
npm run build
npm audit
```
