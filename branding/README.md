# FlowTwin QR assets

- `flowtwin-qr-card.png`: branded Arabic card, 2400 × 3200 pixels, 300 DPI.
- `flowtwin-qr-card.svg`: vector card with embedded project fonts.
- `flowtwin-qr.png` and `flowtwin-qr.svg`: standalone green QR symbol with a six-module white quiet zone.
- `qr-validation.json`: decoding checks at full resolution, reduced size, JPEG compression and rotation.

The QR opens the existing hosted platform: https://flowtwin-naklthon-lab.woodsy-curry-9308.chatgpt.site/

The card uses the existing header's four-bar mark, IBM Plex Sans Arabic and Space Grotesk, and the project's cream/dark/green palette. Font licenses are in `dist/fonts/`. The artwork keeps the logo outside the QR matrix.

Updating this GitHub repository does not itself deploy a Sites version. The QR retains the hosted platform's current URL and existing access settings.

To regenerate, install `qrcode[pil]`, `zxing-cpp`, `arabic-reshaper` and `python-bidi`, then run `python branding/generate_qr.py` from the repository root.
