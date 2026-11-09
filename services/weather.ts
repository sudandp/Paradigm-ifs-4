/**
 * Paradigm IFS - Weather Intelligence & Broadcast Service
 * Zero-Cost Architecture using Open-Meteo Weather + Air Quality APIs.
 * 
 * Provides:
 * - Live Current & Hourly Forecasts (Precipitation, Rain Probability, Temp, UV, Wind, Humidity, AQI, Visibility)
 * - Automated Rain & Extreme Weather Risk Assessment
 * - Automated Facilities / Operations Task Generation (Drains, Terrace, Sump Pumps, Rainwear)
 * - Commute & Travel Time Index for field staff
 * - Smart Morning Briefing generation
 * - 15-minute LocalStorage caching for battery & data savings
 */

export interface HourlyWeather {
  time: string; // ISO string
  temperature: number; // °C
  apparentTemperature: number; // °C
  precipitationProbability: number; // %
  precipitation: number; // mm
  weatherCode: number;
  windSpeed: number; // km/h
  uvIndex: number;
  relativeHumidity: number; // %
  weatherDesc: string;
  weatherIcon: string;
}

export interface DailyWeather {
  date: string;
  weatherCode: number;
  weatherDesc: string;
  weatherIcon: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbabilityMax: number;
  precipitationSum: number;
  windSpeedMax: number;
  uvIndexMax: number;
}

export interface WeatherBroadcastData {
  latitude: number;
  longitude: number;
  timezone: string;
  city: string;
  current: {
    temperature: number;
    apparentTemperature: number;
    relativeHumidity: number;
    precipitationProbability: number;
    precipitation: number;
    weatherCode: number;
    weatherDesc: string;
    weatherIcon: string;
    windSpeed: number;
    windDirection: string;
    windGusts: number;
    uvIndex: number;
    uvIndexMax: number;
    visibility: number; // in km
    cloudCover: number; // %
    pressure: number; // hPa
    aqi?: number;
    aqiCategory?: string;
    pm25?: number;
    isDay: boolean;
  };
  hourly: HourlyWeather[];
  daily: DailyWeather[];
  travelIndex: TravelWindow[];
  activeRisks: WeatherRisk[];
  suggestedTasks: SuggestedWeatherTask[];
  morningBriefing: MorningBriefing;
  lastUpdated: string;
}

export interface TravelWindow {
  timeSlot: string; // e.g. "08:00 - 11:00"
  status: 'EXCELLENT' | 'GOOD' | 'CAUTION' | 'AVOID';
  score: number; // 0 - 100
  rainProbability: number;
  reason: string;
}

export interface WeatherRisk {
  id: string;
  type: 'RAIN_IMMIGRANT' | 'HEAVY_DOWNPOUR' | 'HIGH_WIND' | 'HEATWAVE' | 'HIGH_UV' | 'FOG';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  timing: string;
  icon: string;
}

export interface SuggestedWeatherTask {
  id: string;
  title: string;
  category: 'FACILITIES' | 'ELECTRICAL' | 'SECURITY' | 'SAFETY';
  urgency: 'NORMAL' | 'HIGH' | 'CRITICAL';
  description: string;
  suggestedRole: string;
  actionCode: string;
}

export interface MorningBriefing {
  greeting: string;
  headline: string;
  rainExpected: boolean;
  rainPeakTime?: string;
  rainPeakProbability?: number;
  clothingAdvice: string;
  outdoorWorkAdvisory: string;
  travelAdvice: string;
}

// Default Fallback Locations
export const DEFAULT_LOCATIONS = [
  { name: 'Bengaluru Tech Park (Bangalore)', lat: 12.9716, lon: 77.5946 },
  { name: 'Pune (Head Office)', lat: 18.5204, lon: 73.8567 },
  { name: 'Mumbai (Site Cluster)', lat: 19.0760, lon: 72.8777 },
  { name: 'Delhi NCR Hub', lat: 28.6139, lon: 77.2090 },
  { name: 'Hyderabad Cybercity', lat: 17.3850, lon: 78.4867 },
  { name: 'Chennai Coastal Cluster', lat: 13.0827, lon: 80.2707 },
];

export function getWindDirection(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((deg % 360) / 22.5);
  return directions[index % 16];
}

export function getAqiCategory(aqi: number): { text: string; color: string } {
  if (aqi <= 50) return { text: 'Good', color: 'emerald' };
  if (aqi <= 100) return { text: 'Moderate', color: 'amber' };
  if (aqi <= 150) return { text: 'Unhealthy for Sensitive', color: 'orange' };
  if (aqi <= 200) return { text: 'Unhealthy', color: 'rose' };
  return { text: 'Hazardous', color: 'red' };
}

// WMO Weather interpretation codes (WW)
export function decodeWeatherCode(code: number): { desc: string; icon: string } {
  switch (code) {
    case 0:
      return { desc: 'Clear sky', icon: '☀️' };
    case 1:
      return { desc: 'Mainly clear', icon: '🌤️' };
    case 2:
      return { desc: 'Partly cloudy', icon: '⛅' };
    case 3:
      return { desc: 'Overcast', icon: '☁️' };
    case 45:
    case 48:
      return { desc: 'Fog & misty haze', icon: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { desc: 'Drizzle (Light to Dense)', icon: '🌦️' };
    case 56:
    case 57:
      return { desc: 'Freezing Drizzle', icon: '🌧️' };
    case 61:
      return { desc: 'Slight rain showers', icon: '🌦️' };
    case 63:
      return { desc: 'Moderate rain', icon: '🌧️' };
    case 65:
      return { desc: 'Heavy downpour', icon: '⛈️' };
    case 66:
    case 67:
      return { desc: 'Freezing rain', icon: '🌧️' };
    case 71:
    case 73:
    case 75:
      return { desc: 'Snow fall', icon: '🌨️' };
    case 80:
      return { desc: 'Slight rain showers', icon: '🌦️' };
    case 81:
      return { desc: 'Moderate rain showers', icon: '🌧️' };
    case 82:
      return { desc: 'Violent rain showers', icon: '⛈️' };
    case 95:
      return { desc: 'Thunderstorm', icon: '⚡' };
    case 96:
    case 99:
      return { desc: 'Thunderstorm with hail', icon: '⛈️' };
    default:
      return { desc: 'Fair skies', icon: '🌤️' };
  }
}

const CACHE_KEY = 'paradigm_weather_broadcast_cache';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch Weather Broadcast Data with rich live telemetry & automated risk analysis
 */
export async function getLiveWeatherBroadcast(
  lat: number = 12.9716,
  lon: number = 77.5946,
  cityName: string = 'Bengaluru Tech Park (Bangalore)',
  forceRefresh = false
): Promise<WeatherBroadcastData> {
  const cacheKey = `${CACHE_KEY}_${lat.toFixed(3)}_${lon.toFixed(3)}`;

  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - new Date(parsed.lastUpdated).getTime();
        if (age < CACHE_TTL_MS) {
          return parsed;
        }
      }
    } catch {
      // Ignore cache parse errors
    }
  }

  // Open-Meteo URL parameters with rich telemetry
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,cloud_cover,visibility` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max` +
    `&timezone=auto&forecast_days=7`;

  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=us_aqi,pm2_5,pm10&timezone=auto`;

  // Fetch Weather & Air Quality in parallel
  const [weatherRes, aqiRes] = await Promise.allSettled([
    fetch(weatherUrl).then((r) => r.json()),
    fetch(aqiUrl).then((r) => r.json()),
  ]);

  if (weatherRes.status !== 'fulfilled') {
    throw new Error('Open-Meteo Weather API failed to load');
  }

  const raw = weatherRes.value;
  const aqiRaw = aqiRes.status === 'fulfilled' ? aqiRes.value : null;

  const currentCode = raw.current?.weather_code ?? 0;
  const decodedCurrent = decodeWeatherCode(currentCode);

  // Parse Hourly (next 36 hours)
  const hourlyTimes: string[] = raw.hourly?.time || [];
  const now = new Date();
  const hourlyData: HourlyWeather[] = [];

  for (let i = 0; i < Math.min(hourlyTimes.length, 36); i++) {
    const t = hourlyTimes[i];
    const code = raw.hourly?.weather_code?.[i] ?? 0;
    const decoded = decodeWeatherCode(code);

    hourlyData.push({
      time: t,
      temperature: Math.round(raw.hourly?.temperature_2m?.[i] ?? 0),
      apparentTemperature: Math.round(raw.hourly?.apparent_temperature?.[i] ?? 0),
      precipitationProbability: Math.round(raw.hourly?.precipitation_probability?.[i] ?? 0),
      precipitation: Number(raw.hourly?.precipitation?.[i] ?? 0),
      weatherCode: code,
      windSpeed: Math.round(raw.hourly?.wind_speed_10m?.[i] ?? 0),
      uvIndex: Math.round(raw.hourly?.uv_index?.[i] ?? 0),
      relativeHumidity: Math.round(raw.hourly?.relative_humidity_2m?.[i] ?? 0),
      weatherDesc: decoded.desc,
      weatherIcon: decoded.icon,
    });
  }

  // Parse Daily (7-day outlook)
  const dailyTimes: string[] = raw.daily?.time || [];
  const dailyData: DailyWeather[] = dailyTimes.map((dateStr, idx) => {
    const code = raw.daily?.weather_code?.[idx] ?? 0;
    const decoded = decodeWeatherCode(code);
    return {
      date: dateStr,
      weatherCode: code,
      weatherDesc: decoded.desc,
      weatherIcon: decoded.icon,
      temperatureMax: Math.round(raw.daily?.temperature_2m_max?.[idx] ?? 0),
      temperatureMin: Math.round(raw.daily?.temperature_2m_min?.[idx] ?? 0),
      precipitationProbabilityMax: Math.round(raw.daily?.precipitation_probability_max?.[idx] ?? 0),
      precipitationSum: Number(raw.daily?.precipitation_sum?.[idx] ?? 0),
      windSpeedMax: Math.round(raw.daily?.wind_speed_10m_max?.[idx] ?? 0),
      uvIndexMax: Math.round(raw.daily?.uv_index_max?.[idx] ?? 0),
    };
  });

  // Calculate Current Precipitation Prob from current hour
  const currentHourIdx = hourlyData.findIndex((h) => {
    const hDate = new Date(h.time);
    return Math.abs(hDate.getTime() - now.getTime()) <= 3600000;
  });
  const currentPrecipProb = currentHourIdx >= 0 ? hourlyData[currentHourIdx].precipitationProbability : 0;
  const currentUv = currentHourIdx >= 0 ? hourlyData[currentHourIdx].uvIndex : 0;
  const maxDayUv = dailyData[0]?.uvIndexMax ?? (raw.daily?.uv_index_max?.[0] ? Math.round(raw.daily.uv_index_max[0]) : 8);

  // Air Quality
  const aqiVal = aqiRaw?.current?.us_aqi ? Math.round(aqiRaw.current.us_aqi) : undefined;
  const aqiCategory = aqiVal !== undefined ? getAqiCategory(aqiVal).text : undefined;
  const pm25Val = aqiRaw?.current?.pm2_5 ? Number(aqiRaw.current.pm2_5.toFixed(1)) : undefined;

  // Intelligent Risk & Task Analysis
  const activeRisks = evaluateRisks(raw.current, hourlyData);
  const suggestedTasks = generateSuggestedTasks(activeRisks, hourlyData);
  const travelIndex = calculateTravelWindows(hourlyData);
  const morningBriefing = generateMorningBriefing(hourlyData, dailyData[0]);

  const broadcast: WeatherBroadcastData = {
    latitude: lat,
    longitude: lon,
    timezone: raw.timezone || 'Asia/Kolkata',
    city: cityName,
    current: {
      temperature: Math.round(raw.current?.temperature_2m ?? 0),
      apparentTemperature: Math.round(raw.current?.apparent_temperature ?? 0),
      relativeHumidity: Math.round(raw.current?.relative_humidity_2m ?? 0),
      precipitationProbability: currentPrecipProb,
      precipitation: Number(raw.current?.precipitation ?? 0),
      weatherCode: currentCode,
      weatherDesc: decodedCurrent.desc,
      weatherIcon: decodedCurrent.icon,
      windSpeed: Math.round(raw.current?.wind_speed_10m ?? 0),
      windDirection: getWindDirection(raw.current?.wind_direction_10m ?? 0),
      windGusts: Math.round(raw.current?.wind_gusts_10m ?? (raw.current?.wind_speed_10m ?? 0) * 1.5),
      uvIndex: currentUv,
      uvIndexMax: maxDayUv,
      visibility: raw.current?.visibility ? Number((raw.current.visibility / 1000).toFixed(1)) : 10,
      cloudCover: Math.round(raw.current?.cloud_cover ?? 0),
      pressure: Math.round(raw.current?.surface_pressure ?? 1013),
      aqi: aqiVal,
      aqiCategory,
      pm25: pm25Val,
      isDay: Boolean(raw.current?.is_day ?? 1),
    },
    hourly: hourlyData,
    daily: dailyData,
    travelIndex,
    activeRisks,
    suggestedTasks,
    morningBriefing,
    lastUpdated: new Date().toISOString(),
  };

  try {
    localStorage.setItem(cacheKey, JSON.stringify(broadcast));
  } catch {
    // Storage might be full
  }

  return broadcast;
}

/**
 * Evaluates weather conditions across the next 6-12 hours to flag operational risks
 */
function evaluateRisks(current: any, hourly: HourlyWeather[]): WeatherRisk[] {
  const risks: WeatherRisk[] = [];
  const now = Date.now();

  const upcoming8Hours = hourly.filter((h) => {
    const diff = new Date(h.time).getTime() - now;
    return diff >= -1800000 && diff <= 8 * 3600000;
  });

  // 1. Rain Risk Check
  const highRainSlot = upcoming8Hours.find((h) => h.precipitationProbability >= 65 || h.precipitation >= 1.5);
  const criticalRainSlot = upcoming8Hours.find((h) => h.precipitationProbability >= 85 || h.precipitation >= 5);

  if (criticalRainSlot) {
    const t = new Date(criticalRainSlot.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    risks.push({
      id: 'rain-critical',
      type: 'HEAVY_DOWNPOUR',
      severity: 'CRITICAL',
      title: 'Heavy Downpour Alert',
      message: `Downpour expected around ${t} (${criticalRainSlot.precipitationProbability}% chance, ${criticalRainSlot.precipitation}mm). Sump pits and storm drains require immediate inspection.`,
      timing: t,
      icon: '⛈️',
    });
  } else if (highRainSlot) {
    const t = new Date(highRainSlot.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    risks.push({
      id: 'rain-high',
      type: 'RAIN_IMMIGRANT',
      severity: 'HIGH',
      title: 'Rain Shower Advisory',
      message: `Moderate rain expected around ${t} (${highRainSlot.precipitationProbability}% chance). Close terrace doors, verify window seals, and equip patrol staff.`,
      timing: t,
      icon: '🌧️',
    });
  }

  // 2. High Wind Risk Check (> 35 km/h)
  const highWind = upcoming8Hours.find((h) => h.windSpeed >= 35);
  if (highWind) {
    const t = new Date(highWind.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    risks.push({
      id: 'wind-warning',
      type: 'HIGH_WIND',
      severity: 'MEDIUM',
      title: 'High Wind Velocity',
      message: `Gusts up to ${highWind.windSpeed} km/h around ${t}. Secure loose terrace equipment, façade scaffolding, and display banners.`,
      timing: t,
      icon: '💨',
    });
  }

  // 3. High UV Index Check (UV > 8)
  const highUv = upcoming8Hours.find((h) => h.uvIndex >= 8);
  if (highUv) {
    risks.push({
      id: 'uv-warning',
      type: 'HIGH_UV',
      severity: 'LOW',
      title: 'Extreme UV Index',
      message: `UV Index reaches ${highUv.uvIndex} (Very High). Outdoor horticulture and security staff must rotate and wear protective headgear.`,
      timing: 'Midday',
      icon: '☀️',
    });
  }

  return risks;
}

/**
 * Automatically creates actionable facility & safety tasks based on weather severity
 */
function generateSuggestedTasks(risks: WeatherRisk[], hourly: HourlyWeather[]): SuggestedWeatherTask[] {
  const tasks: SuggestedWeatherTask[] = [];

  const hasHeavyRain = risks.some((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH');
  const hasModerateRain = risks.some((r) => r.type === 'RAIN_IMMIGRANT');
  const hasHighWind = risks.some((r) => r.type === 'HIGH_WIND');

  if (hasHeavyRain || hasModerateRain) {
    tasks.push({
      id: 'task-drain-valves',
      title: 'Check Storm Drain Valves & Desilt Pits',
      category: 'FACILITIES',
      urgency: hasHeavyRain ? 'CRITICAL' : 'HIGH',
      description: 'Clear leaves/debris from stormwater grills, verify non-return valves are free, test basement drain pit water level.',
      suggestedRole: 'MEP / Technical Team',
      actionCode: 'CHECK_DRAINS',
    });

    tasks.push({
      id: 'task-terrace-doors',
      title: 'Lock Terrace Doors & Fire Shaft Windows',
      category: 'SECURITY',
      urgency: hasHeavyRain ? 'CRITICAL' : 'HIGH',
      description: 'Secure all terrace access hatches, parapet doors, and staircase glass louvers to prevent rain water ingress into lift shafts.',
      suggestedRole: 'Security / Patrol Staff',
      actionCode: 'LOCK_TERRACE',
    });

    tasks.push({
      id: 'task-sump-pumps',
      title: 'Verify Basement Sump Pumps on AUTO',
      category: 'ELECTRICAL',
      urgency: hasHeavyRain ? 'CRITICAL' : 'HIGH',
      description: 'Check control panel selector switches: Primary and Standby de-watering pumps must be switched to AUTO mode with float switches tested.',
      suggestedRole: 'MEP / Electrician',
      actionCode: 'VERIFY_PUMPS',
    });

    tasks.push({
      id: 'task-rainwear-kit',
      title: 'Distribute Rainwear Kits to Gate & Perimeter Guards',
      category: 'SAFETY',
      urgency: 'HIGH',
      description: 'Issue raincoats, umbrellas, and waterproof torchlights to main gate sentries and peripheral boundary patrolling guards.',
      suggestedRole: 'Site Supervisor',
      actionCode: 'ISSUE_RAINWEAR',
    });
  }

  if (hasHighWind) {
    tasks.push({
      id: 'task-secure-scaffold',
      title: 'Inspect Scaffolding & Rooftop Banners',
      category: 'FACILITIES',
      urgency: 'HIGH',
      description: 'Anchor or lower temporary canvas shades, tie down maintenance cradles, and inspect rooftop solar panel fasteners.',
      suggestedRole: 'Facility Executive',
      actionCode: 'ANCHOR_SHADES',
    });
  }

  // Baseline proactive housekeeping task if no extreme weather
  if (tasks.length === 0) {
    tasks.push({
      id: 'task-routine-inspection',
      title: 'Routine Plant Room & Perimeter Audit',
      category: 'FACILITIES',
      urgency: 'NORMAL',
      description: 'Weather is clear. Conduct routine check of AHU drainage trays, rainwater harvesting filtration chambers, and external lighting.',
      suggestedRole: 'General Shift Technician',
      actionCode: 'ROUTINE_CHECK',
    });
  }

  return tasks;
}

/**
 * Calculates travel safety windows for field technicians, supervisors, and sales executives
 */
function calculateTravelWindows(hourly: HourlyWeather[]): TravelWindow[] {
  const windows: TravelWindow[] = [];

  const timeSlots = [
    { name: 'Early Morning (06:00 - 09:30)', startH: 6, endH: 9 },
    { name: 'Morning Peak (09:30 - 13:00)', startH: 9, endH: 13 },
    { name: 'Afternoon (13:00 - 17:00)', startH: 13, endH: 17 },
    { name: 'Evening Commute (17:00 - 21:00)', startH: 17, endH: 21 },
    { name: 'Night Shift (21:00 - 02:00)', startH: 21, endH: 26 },
  ];

  for (const slot of timeSlots) {
    const slotHours = hourly.filter((h) => {
      const d = new Date(h.time);
      const hour = d.getHours();
      return hour >= slot.startH && hour < slot.endH;
    });

    if (slotHours.length === 0) continue;

    const maxRainProb = Math.max(...slotHours.map((h) => h.precipitationProbability));
    const totalRainMm = slotHours.reduce((sum, h) => sum + h.precipitation, 0);
    const maxWind = Math.max(...slotHours.map((h) => h.windSpeed));

    let status: TravelWindow['status'] = 'EXCELLENT';
    let score = 95;
    let reason = 'Clear roads and comfortable transit conditions.';

    if (maxRainProb >= 80 || totalRainMm >= 5) {
      status = 'AVOID';
      score = 25;
      reason = 'High chance of waterlogging, poor visibility, and transit delays.';
    } else if (maxRainProb >= 55 || totalRainMm >= 1.5 || maxWind >= 35) {
      status = 'CAUTION';
      score = 55;
      reason = 'Intermittent rain showers. Keep raincoats ready and anticipate minor traffic slowing.';
    } else if (maxRainProb >= 30) {
      status = 'GOOD';
      score = 80;
      reason = 'Overcast sky with slight drizzle possibility. Safe for 2-wheeler commute.';
    }

    windows.push({
      timeSlot: slot.name,
      status,
      score,
      rainProbability: maxRainProb,
      reason,
    });
  }

  return windows;
}

/**
 * Creates user-friendly personalized morning briefing for app landing
 */
function generateMorningBriefing(hourly: HourlyWeather[], todayDaily?: DailyWeather): MorningBriefing {
  const rainHours = hourly.filter((h) => h.precipitationProbability >= 45);
  const peakRainHour = [...hourly].sort((a, b) => b.precipitationProbability - a.precipitationProbability)[0];

  const rainExpected = (peakRainHour?.precipitationProbability ?? 0) >= 45;

  let peakTimeStr = '';
  if (peakRainHour && rainExpected) {
    peakTimeStr = new Date(peakRainHour.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  let clothingAdvice = 'Regular work uniform is comfortable today.';
  if (rainExpected) {
    clothingAdvice = '🌧️ Carry a raincoat or compact umbrella today. Water-resistant safety shoes recommended.';
  } else if ((todayDaily?.temperatureMax ?? 30) >= 36) {
    clothingAdvice = '☀️ High temperature expected. Wear breathable cottons and keep an insulated water bottle.';
  }

  let travelAdvice = 'Commute conditions are normal across your route.';
  if (rainExpected) {
    travelAdvice = `Best travel window is before ${peakTimeStr || 'noon'}. Avoid two-wheeler transit during peak shower hours.`;
  }

  return {
    greeting: getDaytimeGreeting(),
    headline: rainExpected
      ? `Rain alert today! Peak probability around ${peakTimeStr} (${peakRainHour?.precipitationProbability}%).`
      : `Pleasant weather today with high of ${todayDaily?.temperatureMax ?? 31}°C.`,
    rainExpected,
    rainPeakTime: peakTimeStr,
    rainPeakProbability: peakRainHour?.precipitationProbability,
    clothingAdvice,
    outdoorWorkAdvisory: rainExpected
      ? 'Schedule external façade, rooftop, and landscape maintenance during morning dry windows.'
      : 'Optimal weather for outdoor PPM, garden trimming, and exterior civil audits.',
    travelAdvice,
  };
}

function getDaytimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}
