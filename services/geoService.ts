import { GeoLocation } from '../types';

export const getUserLocation = async (): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      // Default to a known location (e.g., Downtown Sao Paulo) if geo unavailable
      resolve({ lat: -23.5505, lng: -46.6333, countryCode: 'BRA' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // We don't need strict reverse geocoding for the grid system, just coords
        resolve({
          lat: latitude,
          lng: longitude,
          countryCode: 'LOC' 
        });
      },
      (error) => {
        console.warn("Geo error, using fallback", error);
        // Fallback to coordinates (Sao Paulo)
        resolve({ lat: -23.5505, lng: -46.6333, countryCode: 'BRA' });
      },
      { 
        enableHighAccuracy: true, // Crucial for street level
        timeout: 15000, 
        maximumAge: 0 
      }
    );
  });
};