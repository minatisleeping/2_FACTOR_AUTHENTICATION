import authorizedAxiosInstance from '~/utils/authorizedAxios'
import { API_ROOT } from '~/utils/constants'

export const loginAPI = async (data) => {
  const res = await authorizedAxiosInstance.post(`${API_ROOT}/v1/users/login`, data)
  return res.data
}

export const logoutAPI = async (userId) => {
  return await authorizedAxiosInstance.delete(`${API_ROOT}/v1/users/${userId}/logout`)
}

export const fetchUserAPI = async () => {
  const currentUser = JSON.parse(localStorage.getItem('userInfo'))

  const res = await authorizedAxiosInstance.get(`${API_ROOT}/v1/users/${currentUser._id}`)
  const user = res.data

  localStorage.setItem('userInfo', JSON.stringify(user))

  return user
}

export const get2FA_QRCodeAPI = async (userId) => {
  const res = await authorizedAxiosInstance.get(`${API_ROOT}/v1/users/${userId}/get_2fa_qr_code`)
  return res.data
}

export const setup2FA_API = async (userId, otp) => {
  const res = await authorizedAxiosInstance.post(`${API_ROOT}/v1/users/${userId}/setup_2fa`, { otp })
  return res.data
}

export const verify2FA_API = async (userId, otp) => {
  const res = await authorizedAxiosInstance.put(`${API_ROOT}/v1/users/${userId}/verify_2fa`, { otp })
  return res.data
}
