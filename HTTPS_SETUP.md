# HTTPS Setup for Mobile Camera Access

## Why HTTPS is Required

Modern browsers (especially on mobile devices) require HTTPS for camera access. This is a security feature to protect user privacy.

## Quick Setup

### 1. Start the Server
```bash
cd server
PORT=5001 npx ts-node src/server.ts
```

### 2. Start the Client with HTTPS
```bash
cd client
npm run start-https
```

The app will be available at: `https://localhost:3000`

### 3. Access on Mobile

1. Find your computer's IP address:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. On your mobile device, visit:
   ```
   https://YOUR_IP_ADDRESS:3000
   ```

3. Accept the security warning (self-signed certificate)

4. Allow camera permissions when prompted

## Alternative: Use ngrok for Public HTTPS

If you want to test with a public HTTPS URL:

1. Install ngrok: `npm install -g ngrok`

2. Start your app normally (HTTP):
   ```bash
   cd client
   npm start
   ```

3. Create HTTPS tunnel:
   ```bash
   ngrok http 3000
   ```

4. Use the ngrok URL on your mobile device

## Troubleshooting

### Camera Permission Issues
- Make sure you're using HTTPS
- Check browser settings for camera permissions
- Try refreshing the page
- Ensure no other apps are using the camera

### Certificate Warnings
- Click "Advanced" and "Proceed to localhost"
- This is normal for self-signed certificates

### Network Issues
- Make sure your mobile device is on the same WiFi network
- Check firewall settings
- Try using ngrok for public access 