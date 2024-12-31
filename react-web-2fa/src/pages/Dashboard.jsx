import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import { useNavigate } from 'react-router-dom'
import { fetchUserAPI, logoutAPI } from '~/apis'
import Setup2FA from '~/components/setup-2fa'
import Require2FA from '~/components/require-2fa'

function Dashboard() {
  const [user, setUser] = useState(null)
  const [openSetup2FA, setOpenSetup2FA] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      const user = await fetchUserAPI()
      console.log('🚀 ~ user:', user)
      setUser(user)
    }

    fetchData()
  }, [])

  const handleLogout = async () => {
    await logoutAPI(user._id)
    localStorage.removeItem('userInfo')

    navigate('/login')
  }

  const handleSuccessSetup2FA = (updatedUser) => {
    setUser(updatedUser)

    localStorage.setItem('userInfo', JSON.stringify(updatedUser))

    setOpenSetup2FA(false)
  }

  if (!user) {
    return (
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: '100vw',
        height: '100vh'
      }}>
        <CircularProgress />
        <Typography>Loading dashboard user...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{
      maxWidth: '1120px',
      margin: '1em auto',
      display: 'flex',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 1,
      padding: '0 1em'
    }}>
      {/* Modal để user cài đặt 2FA */}
      <Setup2FA
        isOpen={openSetup2FA}
        toggleOpen={setOpenSetup2FA}
        user={user}
        handleSuccessSetup2FA={handleSuccessSetup2FA}
      />

      {/* Modal yêu cầu xác thực 2FA */}
      {/* Với điều kiện user đã bật tính năng 2FA, và user chưa xác thực 2FA ngay sau khi đăng nhập ở lần tiếp theo */}
      {user.require_2fa && !user.is_2fa_verified && <Require2FA />}

      <Box>
        <a style={{ color: 'inherit', textDecoration: 'none' }} href='https://github.com/minatisleeping' target='_blank' rel='noreferrer'>
          <img
            style={{ width: '100%', height: '180px', borderRadius: '6px', objectFit: 'cover' }}
            src="src/assets/Cover-3556x2000.png"
            alt="cover"
          />
        </a>
      </Box>

      <Alert severity="info" sx={{ '.MuiAlert-message': { overflow: 'hidden' } }}>
        Đây là trang Dashboard sau khi user:&nbsp;
        <Typography variant="span" sx={{ fontWeight: 'bold', '&:hover': { color: '#e67e22', cursor: 'pointer' } }}>
          {user.email}
        </Typography>
        &nbsp;đăng nhập thành công thì mới cho truy cập vào.
      </Alert>

      <Alert severity={`${user.require_2fa ? 'success' : 'warning'}`} sx={{ '.MuiAlert-message': { overflow: 'hidden' } }}>
        Tình trạng bảo mật tài khoản:&nbsp;
        <Typography variant="span" sx={{ fontWeight: 'bold', '&:hover': { color: '#e67e22', cursor: 'pointer' } }}>
          {user.require_2fa ? 'Đã Bật' : 'Chưa Bật'} xác thực 2 lớp - Two-Factor Authentication (2FA)
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'end', gap: 2, mt: 1 }}>
        {!user.require_2fa &&
          <Button
            type='button'
            variant='contained'
            color='warning'
            size='large'
            sx={{ maxWidth: 'max-content' }}
            onClick={() => setOpenSetup2FA(true)}
          >
            Enable 2FA
          </Button>
        }

        <Button
          type='button'
          variant='contained'
          color='info'
          size='large'
          sx={{ maxWidth: 'max-content' }}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ textAlign: 'right' }}>
        Author:&nbsp;
        <Typography variant="span" sx={{ fontWeight: 'bold', '&:hover': { color: '#fdba26' } }}>
          <a style={{ color: 'inherit', textDecoration: 'none' }} href='https://github.com/minatisleeping' target='_blank' rel='noreferrer'>
            Minatisleeping
          </a>
        </Typography>
      </Box>
    </Box>
  )
}

export default Dashboard
