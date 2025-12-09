import { GeoLocation } from '../types';

export const getUserLocation = async (): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      // Fallback to rough IP estimation if Geo API not available
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
          resolve({
            lat: data.latitude,
            lng: data.longitude,
            countryCode: data.country_code_iso3 || data.country
          });
        })
        .catch(() => reject(new Error("Geolocation not supported and IP fallback failed")));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Optional: Reverse Geocode to get ISO code if needed immediately
        // For now, we return coords and let the map match it
        resolve({
          lat: latitude,
          lng: longitude,
        });
      },
      (error) => {
        console.error("Geo error, trying IP fallback", error);
        fetch('https://ipapi.co/json/')
          .then(res => res.json())
          .then(data => {
            resolve({
              lat: data.latitude,
              lng: data.longitude,
              countryCode: data.country_code_iso3 || data.country
            });
          })
          .catch(e => reject(e));
      }
    );
  });
};

// Helper to calculate distance (Harversine) - strictly for simple checks
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}