window.RECORD_DIVE_CONFIG = {
  CLIENT_ID: "YOUR_SPOTIFY_CLIENT_ID_HERE",
  REDIRECT_URI: window.location.origin + window.location.pathname,
  SCOPES: "user-top-read user-read-private user-read-email",
  TOKEN_ENDPOINT: "https://accounts.spotify.com/api/token",
  AUTH_URL: "https://accounts.spotify.com/authorize"
};
