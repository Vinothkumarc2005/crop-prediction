import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: any) => api.post('/auth/register', data).then(r => r.data),
  login:    (data: any) => api.post('/auth/login',    data).then(r => r.data),
  me:       ()          => api.get('/auth/me').then(r => r.data),
}

// ── Fields ────────────────────────────────────────────────────────────────
export const fieldsApi = {
  create:       (data: any)  => api.post('/fields', data).then(r => r.data),
  list:         ()           => api.get('/fields').then(r => r.data),
  get:          (id: string) => api.get(`/fields/${id}`).then(r => r.data),
  ndvi:         (id: string) => api.get(`/fields/${id}/ndvi`).then(r => r.data),
  ndviForecast: (id: string, months = 6) =>
    api.get(`/fields/${id}/ndvi/forecast`, { params: { months } }).then(r => r.data),
  weather:      (id: string, season = 'Kharif', years = 10) =>
    api.get(`/fields/${id}/weather`, { params: { season, years } }).then(r => r.data),
  soil:         (id: string) => api.get(`/fields/${id}/soil`).then(r => r.data),
  history:      (id: string) => api.get(`/fields/${id}/history`).then(r => r.data),
  delete:       (id: string) => api.delete(`/fields/${id}`),
}

// ── Predictions ───────────────────────────────────────────────────────────
export const predictApi = {
  yield:     (data: any) => api.post('/predict/yield', data).then(r => r.data),
  recommend: (data: any) => api.post('/recommend/crops', data).then(r => r.data),
}

// ── Mandi Prices ──────────────────────────────────────────────────────────
export const mandiApi = {
  search: (params: any) =>
    api.get('/mandi-prices', { params }).then(r => {
      if (Array.isArray(r.data)) return r.data
      return r.data?.prices || []
    }),
  commodities: () =>
    api.get('/mandi-prices/commodities').then(r => {
      if (Array.isArray(r.data)) return r.data
      return r.data?.value || []
    }),
  trend: (commodity: string, district: string) =>
    api.get('/mandi-prices/trend', { params: { commodity, district } }).then(r => {
      if (Array.isArray(r.data)) return r.data
      return r.data?.series || []
    }),
}

// ── Feedback ──────────────────────────────────────────────────────────────
export const feedbackApi = {
  log:     (data: any)    => api.post('/feedback', data).then(r => r.data),
  byField: (id: string)   => api.get(`/feedback/field/${id}`).then(r => r.data),
  summary: (id: string)   => api.get(`/feedback/summary/${id}`).then(r => r.data),
}

// ── Weather ───────────────────────────────────────────────────────────────
export const weatherApi = {
  district: (district: string, state: string, season = 'Kharif', years = 10) =>
    api.get('/weather', { params: { district, state, season, years } }).then(r => r.data),
  forecast: (district: string, state: string, months = 6) =>
    api.get('/weather/forecast', { params: { district, state, months } }).then(r => r.data),
}

export default api
