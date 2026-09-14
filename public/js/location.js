// PROTOKOL — Geolocation Module (GPS)

const PILOT_DEFAULT_GPS = {
  lat: -13.158800,
  lng: -74.223600,
  accuracy: 10,
  source: 'PILOT_DEFAULT'
};

/**
 * Obtains device GPS coordinates with high accuracy.
 */
export async function getDeviceLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[GPS] Geolocation not supported by device. Using pilot coordinates.');
      return resolve(PILOT_DEFAULT_GPS);
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          source: 'DEVICE_GPS'
        });
      },
      (err) => {
        console.warn(`[GPS] Geolocation error (${err.code}): ${err.message}. Using pilot coordinates.`);
        resolve(PILOT_DEFAULT_GPS);
      },
      options
    );
  });
}
