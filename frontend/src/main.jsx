import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import App from './App'
import './index.css'

dayjs.locale('es')

// INEMEC Corporate Theme
// Based on INEMEC Frontend Development Guide
const theme = {
  token: {
    // Primary: Red (energy and dynamism)
    colorPrimary: '#D52B1E',
    colorPrimaryHover: '#B22318',
    colorPrimaryActive: '#8A1C13',
    // Secondary: Gray (sobriety and elegance)
    colorTextSecondary: '#939598',
    // Status colors
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    colorInfo: '#D52B1E',
    // Typography
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    // Spacing based on 8px grid
    borderRadius: 6,
    // Link color matches primary
    colorLink: '#D52B1E',
    colorLinkHover: '#B22318',
    colorLinkActive: '#8A1C13'
  },
  components: {
    Button: {
      colorPrimary: '#D52B1E',
      colorPrimaryHover: '#B22318',
      colorPrimaryActive: '#8A1C13'
    },
    Menu: {
      darkItemBg: '#1a1a1a',
      darkSubMenuItemBg: '#141414',
      darkItemSelectedBg: '#D52B1E',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.1)',
      horizontalItemSelectedColor: '#D52B1E',
      horizontalItemHoverColor: '#D52B1E'
    },
    Layout: {
      siderBg: '#1a1a1a',
      headerBg: '#1a1a1a',
      footerBg: '#1a1a1a'
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={esES} theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
)
