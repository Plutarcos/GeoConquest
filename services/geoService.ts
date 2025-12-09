import { GeoLocation } from '../types';

export const getUserLocation = async (): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      fallbackToIP(resolve, reject);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Attempt to get ISO code from coords using a free reverse geocoding API
        // This is important because the game relies on ISO 3 codes
        try {
          const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          const data = await response.json();
          // data.countryCode is usually ISO 2, data.isoAlpha3 is ISO 3 if available.
          // BigDataCloud free endpoint usually returns countryCode (2 chars). 
          // We might need to map it or find a field. 
          // Actually bigdatacloud returns "countryCode" as ISO 2 usually. 
          // Let's try to find an ISO 3 field or use a lookup. 
          // However, ipapi returns iso3. 
          // If this fails to give 3-letter code, we might fall back to IP for code.
          // Note: BigDataCloud generic free tier often gives `countryCode` (ISO2).
          // Let's try another source or just fallback to IP for the code if we can't get it easily.
          // For now, let's use the coords and try to rely on IP for the country string if needed, 
          // or just assume we can match it on the map later.
          // BUT, to select the territory by ID we need ISO 3.
          
          // Let's fallback to IP API which gives ISO3 reliably for the 'start' location suggestion.
          // The coordinates are still useful for the map view, but for logic we need the ID.
          fallbackToIP(resolve, reject, { lat: latitude, lng: longitude });
          
        } catch (e) {
          fallbackToIP(resolve, reject, { lat: latitude, lng: longitude });
        }
      },
      (error) => {
        console.error("Geo error, trying IP fallback", error);
        fallbackToIP(resolve, reject);
      }
    );
  });
};

const fallbackToIP = (resolve: Function, reject: Function, overrideCoords?: {lat: number, lng: number}) => {
  fetch('https://ipapi.co/json/')
    .then(res => res.json())
    .then(data => {
      resolve({
        lat: overrideCoords ? overrideCoords.lat : data.latitude,
        lng: overrideCoords ? overrideCoords.lng : data.longitude,
        countryCode: data.country_code_iso3 || data.country
      });
    })
    .catch(() => {
       // If all fails, resolve with default (User will have to select manually)
       resolve({ lat: 0, lng: 0, countryCode: null });
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