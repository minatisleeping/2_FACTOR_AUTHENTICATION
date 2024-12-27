import { StatusCodes } from 'http-status-codes'
import { authenticator } from 'otplib'
import { pickUser } from '~/utils/formatters'
import QRCode from 'qrcode'
import path from 'path'


const Datastore = require('nedb-promises')
const UserDB = Datastore.create(({
  filename: path.resolve(__dirname, '../database/users.json'),
  autoload: true
}))
const TwoFactorSecretKeyDB = Datastore.create({
  filename: path.resolve(__dirname, '../database/2fa_secret_keys.json'),
  autoload: true
})

const SERVICE_NAME = '2FA - 2 Factor Authentication'

const login = async (req, res) => {
  try {
    const user = await UserDB.findOne({ email: req.body.email })
    if (!user) {

      res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found!' })
      return
    }
    // Kiểm tra mật khẩu "đơn giản". LƯU Ý: Thực tế phải dùng bcryptjs để hash mật khẩu,
    // đảm bảo mật khẩu được bảo mật
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

export const userController = {
  login,
  getUser,
  logout,
  get2FA_QRCode
}
