# TrimQ

A progressive web application for appointment scheduling and real-time hybrid queue management at Madrid's Barbershop.

Customers can book a time slot or join the live walk-in queue. Both share one line, so everyone sees their place and estimated wait.

## Status

Initial landing page with PWA setup (manifest, service worker, icon). Booking, queue logic and the barber dashboard are not built yet.

## Run locally

```bash
npm start
```

Or serve the `public/` folder with any static server, for example `python3 -m http.server -d public 3000`.

## Structure

```
public/
  index.html            Landing page
  manifest.webmanifest  PWA manifest
  sw.js                 Service worker (offline cache)
  icons/icon.svg        App icon
```

## Roadmap

- [ ] Appointment booking
- [ ] Walk-in queue with live wait estimates
- [ ] Barber dashboard
- [ ] Push notifications when a customer is next
- [ ] PNG icons for wider install support

## License

MIT
