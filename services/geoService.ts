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
        
        try {
          // Use BigDataCloud free endpoint correctly
          const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          
          if (!response.ok) throw new Error("Geocode failed");
          
          const data = await response.json();
          // Prefer ISO 3 ('isoAlpha3') if available, else 'countryCode' (ISO 2)
          const countryCode = data.isoAlpha3 || data.countryCode;

          resolve({
            lat: latitude,
            lng: longitude,
            countryCode: countryCode
          });
          
        } catch (e) {
          console.warn("Geocoding failed, falling back to IP", e);
          fallbackToIP(resolve, reject, { lat: latitude, lng: longitude });
        }
      },
      (error) => {
        console.error("Geo error, trying IP fallback", error);
        fallbackToIP(resolve, reject);
      },
      { timeout: 10000 }
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
        countryCode: data.country_code_iso3 || data.country_code // ipapi uses country_code_iso3
      });
    })
    .catch((err) => {
       console.error("IP fallback failed", err);
       // If all fails, resolve with null so user can pick manually
       resolve({ lat: 0, lng: 0, countryCode: null });
    });
};