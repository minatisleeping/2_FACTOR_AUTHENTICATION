import { StatusCodes } from 'http-status-codes'
import { authenticator } from 'otplib'
import path from 'path'
import QRCode from 'qrcode'
import { pickUser } from '~/utils/formatters'


const Datastore = require('nedb-promises')
const UserDB = Datastore.create({ filename: path.join(__dirname, '../database/users.json'), autoload: true })
const TwoFactorSecretKeyDB = Datastore.create({ filename: path.join(__dirname, '../database/2fa_secret_keys.json'), autoload: true })
const UserSessionDB = Datastore.create({ filename: path.join(__dirname, '../database/user_sessions.json'), autoload: true })

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

    let resUser = pickUser(user)

    // Tìm phiên login hiện tại của user với device_id
    let currentUserSession = await UserSessionDB.findOne({
      user_id: user._id,
      device_id: req.headers['user-agent']
    })

    // Nếu chưa có phiên login nào thì tạo mới
    if (!currentUserSession) {
      currentUserSession = await UserSessionDB.insert({
        user_id: user._id,
        device_id: req.headers['user-agent'],
        is_2fa_verified: false,
        last_login: new Date().valueOf()
      })
    }

    resUser['is_2fa_verified'] = currentUserSession.is_2fa_verified
    resUser['last_login'] = currentUserSession.last_login

    res.status(StatusCodes.OK).json(resUser)
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

    let resUser = pickUser(user)
    const currentUserSession = await UserSessionDB.findOne({
      user_id: user._id,
      device_id: req.headers['user-agent']
    })
    resUser['is_2fa_verified'] = currentUserSession ? currentUserSession.is_2fa_verified : null
    resUser['last_login'] = currentUserSession ? currentUserSession.last_login : null

    res.status(StatusCodes.OK).json(resUser)
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

    await UserSessionDB.deleteOne({
      user_id: user._id,
      device_id: req.headers['user-agent']
    })
    UserSessionDB.compactDatafileAsync()

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
      const newTwoFactorSecretKey = await TwoFactorSecretKeyDB.insert({
        user_id: user._id,
        value: authenticator.generateSecret()
      })

      twoFactorSecretKeyValue = newTwoFactorSecretKey.value
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
    if (!clientOTP) {
      res.status(StatusCodes.NOT_ACCEPTABLE).json({ message: 'OTP is required!' })
      return
    }

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
    UserDB.compactDatafileAsync()

    const newUserSession = await UserSessionDB.insert({
      user_id: user._id,
      device_id: req.headers['user-agent'],
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

const verify2FA = async (req, res) => {
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
    if (!clientOTP) {
      res.status(StatusCodes.NOT_ACCEPTABLE).json({ message: 'OTP is required!' })
      return
    }

    const isValid = authenticator.verify({
      token:clientOTP,
      secret: twoFactorSecret.value
    })
    if (!isValid) {
      res.status(StatusCodes.NOT_ACCEPTABLE).json({ message: 'Invalid 2FA Token!' })
      return
    }

    const updatedUserSession = await UserSessionDB.update(
      { user_id: user._id, device_id: req.headers['user-agent'] },
      { $set: { is_2fa_verified: true, last_login: new Date().valueOf() } },
      { returnUpdatedDocs: true }
    )
    UserSessionDB.compactDatafileAsync()

    res.status(StatusCodes.OK).json({
      ...pickUser(user),
      is_2fa_verified: updatedUserSession.is_2fa_verified,
      last_login: updatedUserSession.last_login,
      message: '2FA verified successfully!'
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
  setup2FA,
  verify2FA
}
