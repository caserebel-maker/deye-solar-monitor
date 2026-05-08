export type WeatherHour = {
  time: string;
  temperatureC: number;
  weatherCode: number;
  precipProbability: number;
};

export type WeatherForecast = {
  source: "live" | "offline";
  current: { temperatureC: number; weatherCode: number };
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
    temperature_2m: number;
    weather_code: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability?: number[];
  };
};

export async function getWeatherForecast(): Promise<WeatherForecast> {
  const lat = Number(process.env.WEATHER_LAT) || DEFAULT_LAT;
  const lon = Number(process.env.WEATHER_LON) || DEFAULT_LON;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&current=temperature_2m,weather_code` +
    `&forecast_days=2&timezone=auto`;

  try {
    const response = await fetch(url, { next: { revalidate: 600 } });
    if (!response.ok) throw new Error(`Open-Meteo status ${response.status}`);
    const data = (await response.json()) as OpenMeteoResponse;
    if (!data.hourly || !data.current) throw new Error("Open-Meteo missing hourly/current");

    const nowMs = Date.now();
    const allHours: WeatherHour[] = data.hourly.time.map((time, index) => ({
      time,
      temperatureC: data.hourly!.temperature_2m[index],
      weatherCode: data.hourly!.weather_code[index],
      precipProbability: data.hourly!.precipitation_probability?.[index] ?? 0,
    }));
    const startIndex = Math.max(
      0,
      allHours.findIndex((hour) => new Date(hour.time).getTime() >= nowMs - 30 * 60 * 1000),
    );
    const hourly = allHours.slice(startIndex, startIndex + 12);

    return {
      source: "live",
      current: {
        temperatureC: data.current.temperature_2m,
        weatherCode: data.current.weather_code,
      },
      hourly,
      location: { latitude: data.latitude, longitude: data.longitude, timezone: data.timezone },
    };
  } catch (error) {
    console.error("weather forecast failed", error);
    return {
      source: "offline",
      current: { temperatureC: 0, weatherCode: 0 },
      hourly: [],
      location: { latitude: lat, longitude: lon, timezone: "auto" },
    };
  }
}
