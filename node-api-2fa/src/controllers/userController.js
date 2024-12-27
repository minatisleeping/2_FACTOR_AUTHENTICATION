import { StatusCodes } from 'http-status-codes'
import { authenticator } from 'otplib'
import { pickUser } from '~/utils/formatters'
import QRCode from 'qrcode'
import path from 'path'


const Datastore = require('nedb-promises')
const UserDB = Datastore.create({ filename: path.resolve(__dirname, '../database/users.json') })
const TwoFactorSecretKeyDB = Datastore.create({ filename: path.resolve(__dirname, '../database/2fa_secret_keys.json') })
const UserSessionDB = Datastore.create({ filename: path.resolve(__dirname, '../user_sessions/2fa_secret_keys.json') })

const SERVICE_NAME = '2FA - 2 Factor Authentication'

const login = async (req, res) => {
  try {
    const user = await UserDB.findOne({ email: req.body.email })
    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found!' })
      return
    }

    if (user.password !== req.body.password) {
      res.status(StatusCodes.NOT_ACCEPTABLE).json({ message: 'Wrong password!' })
      return
    }

    res.status(StatusCodes.OK).json(pickUser(user))
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
  }
}

const getUser = async (req, res) => {
  try {
    const user = await UserDB.findOne({ _id: req.params.id })
    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found!' })
      return
    }

    res.status(StatusCodes.OK).json(pickUser(user))
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
  }
}

const logout = async (req, res) => {
  try {
    const user = await UserDB.findOne({ _id: req.params.id })
    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found!' })
      return
    }

    // Xóa phiên của user trong Database > user_sessions tại đây khi đăng xuất

    res.status(StatusCodes.OK).json({ loggedOut: true })
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
  }
}

const get2FA_QRCode = async (req, res) => {
  try {
    const user = await UserDB.findOne({ _id: req.params.id })
    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found!' })
      return
    }

    let twoFactorSecretKeyValue = null

    const twoFactorSecret = await TwoFactorSecretKeyDB.findOne({ user_id: user._id })
    if (!twoFactorSecret) {
      const newTwoFactorSecret = await TwoFactorSecretKeyDB.insert({
        user_id: user._id,
        value: authenticator.generateSecret()
      })

      twoFactorSecretKeyValue = newTwoFactorSecret.value
    } else {
      twoFactorSecretKeyValue = twoFactorSecret.value
    }

    // Tạp OTP token
    const OTP_AuthToken = authenticator.keyuri(
      user.username,
      SERVICE_NAME,
      twoFactorSecretKeyValue
    )

    // Tạo ảnh QR Code
    const QRCodeImageUrl = await QRCode.toDataURL(OTP_AuthToken)

    return res.status(StatusCodes.OK).json({ qrcode: QRCodeImageUrl })
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
  }
}

const setup2FA = async (req, res) => {
  try {
    const user = await UserDB.findOne({ _id: req.params.id })
    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found!' })
      return
    }

    const twoFactorSecret = await TwoFactorSecretKeyDB.findOne({ user_id: user._id })
    if (!twoFactorSecret) {
      res.status(StatusCodes.NOT_FOUND).json({ message: '2FA Secret not found!' })
      return
    }

    const clientOTP = req.body.otp
    const isValid = authenticator.verify({
      token:clientOTP,
      secret: twoFactorSecret.value
    })

    if (!isValid) {
      res.status(StatusCodes.NOT_ACCEPTABLE).json({ message: 'Invalid 2FA Token!' })
      return
    }

    const updatedUser = await UserDB.update(
      { _id: user._id },
      { $set: { require_2fa: true } },
      { returnUpdatedDocs: true }
    )

    // Update lại thằng user trong db vì nebd update collection -> dở ác
    UserDB.compactDatafileSync()

    const newUserSession = await UserSessionDB.insert({
      user_id: user._id,
      // Lấy userAgent từ header để định danh browser mà user đang sử dụng (device_id)
      device_id: req.header['user-agent'],
      is_2fa_verified: true,
      last_login: new Date().valueOf()
    })

    res.status(StatusCodes.OK).json({
      ...pickUser(updatedUser),
      is_2fa_verified: newUserSession.is_2fa_verified,
      message: '2FA setup successfully!'
    })
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
  }
}

export const userController = {
  login,
  getUser,
  logout,
  get2FA_QRCode,
  setup2FA
}
