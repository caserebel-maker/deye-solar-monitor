export type WeatherHour = {
  time: string;
  temperatureC: number;
  weatherCode: number;
  precipProbability: number;
  isDay: boolean;
};

export type WeatherForecast = {
  source: "live" | "offline";
  current: { temperatureC: number; weatherCode: number; isDay: boolean };
  hourly: WeatherHour[];
  location: { latitude: number; longitude: number; timezone: string };
};

const DEFAULT_LAT = 13.644809;
const DEFAULT_LON = 100.706098;

type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: {
    time: string;
    temperature_2m: number;
    weather_code: number;
    is_day?: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability?: number[];
    is_day?: number[];
  };
};

export async function getWeatherForecast(): Promise<WeatherForecast> {
  const lat = Number(process.env.WEATHER_LAT) || DEFAULT_LAT;
  const lon = Number(process.env.WEATHER_LON) || DEFAULT_LON;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,weather_code,precipitation_probability,is_day` +
    `&current=temperature_2m,weather_code,is_day` +
    `&forecast_days=2&timezone=auto`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Open-Meteo status ${response.status}`);
    const data = (await response.json()) as OpenMeteoResponse;
    if (!data.hourly || !data.current) throw new Error("Open-Meteo missing hourly/current");

    const allHours: WeatherHour[] = data.hourly.time.map((time, index) => ({
      time,
      temperatureC: data.hourly!.temperature_2m[index],
      weatherCode: data.hourly!.weather_code[index],
      precipProbability: data.hourly!.precipitation_probability?.[index] ?? 0,
      isDay: (data.hourly!.is_day?.[index] ?? 1) === 1,
    }));
    // Anchor on the local hour Open-Meteo reports as "current" — both fields
    // are returned in the same local-time format with no timezone offset, so
    // a plain string match avoids any UTC parsing pitfalls on the Vercel runtime.
    const currentHourString = data.current.time.slice(0, 13) + ":00";
    const matchIndex = data.hourly.time.findIndex((time) => time === currentHourString);
    const startIndex = matchIndex >= 0 ? matchIndex : 0;
    const hourly = allHours.slice(startIndex, startIndex + 12);

    return {
      source: "live",
      current: {
        temperatureC: data.current.temperature_2m,
        weatherCode: data.current.weather_code,
        isDay: (data.current.is_day ?? 1) === 1,
      },
      hourly,
      location: { latitude: data.latitude, longitude: data.longitude, timezone: data.timezone },
    };
  } catch (error) {
    console.error("weather forecast failed", error);
    return {
      source: "offline",
      current: { temperatureC: 0, weatherCode: 0, isDay: true },
      hourly: [],
      location: { latitude: lat, longitude: lon, timezone: "auto" },
    };
  }
}
