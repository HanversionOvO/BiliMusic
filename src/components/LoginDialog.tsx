import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Loader2, Smartphone, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import QRCode from 'qrcode'
import { generateQrCode, pollQrCode } from '@/services/api'

type QrStatus = 'loading' | 'waiting' | 'scanned' | 'success' | 'expired' | 'error'

interface LoginDialogProps {
  onClose: () => void
  onSuccess: () => void
}

export default function LoginDialog({ onClose, onSuccess }: LoginDialogProps) {
  const [status, setStatus] = useState<QrStatus>('loading')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [qrcodeKey, setQrcodeKey] = useState<string>('')
  const [countdown, setCountdown] = useState(180)
  const [errorMsg, setErrorMsg] = useState('')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  // 轮询扫码状态
  const startPolling = useCallback((key: string) => {
    stopPolling()

    pollTimerRef.current = setInterval(async () => {
      try {
        const result = await pollQrCode(key)

        if (result.status === 0 || result.code === 0) {
          setStatus('success')
          stopPolling()
          setTimeout(() => onSuccess(), 800)
        } else if (result.status === 86090) {
          setStatus('scanned')
        } else if (result.code === 86038 || result.status === 86038) {
          setStatus('expired')
          stopPolling()
        }
      } catch {
        // 网络波动继续轮询，不中断流程
      }
    }, 2000)
  }, [onSuccess, stopPolling])

  // 生成二维码
  const generate = useCallback(async () => {
    setStatus('loading')
    setErrorMsg('')
    setCountdown(180)

    try {
      const data = await generateQrCode()
      const dataUrl = await QRCode.toDataURL(data.url, {
        width: 200,
        margin: 2,
        color: { dark: '#18191C', light: '#FFFFFF' },
      })
      setQrDataUrl(dataUrl)
      setQrcodeKey(data.qrcodeKey)
      setStatus('waiting')
      startPolling(data.qrcodeKey)
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e.message || '生成二维码失败，请检查网络后重试')
    }
  }, [startPolling])

  // 倒计时
  useEffect(() => {
    if (status !== 'waiting' && status !== 'scanned') return

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setStatus('expired')
          stopPolling()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [status, stopPolling])

  // 初始化生成二维码
  useEffect(() => {
    generate()
    return () => stopPolling()
  }, [generate, stopPolling])

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="glass-panel-heavy"
        style={{
          width: 360,
          padding: 'var(--space-2xl)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-lg)',
          animation: 'fadeIn 250ms var(--easing-spring)',
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="text-h2">BiliBili 扫码登录</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* QR Code Area */}
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 'var(--radius-md)',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {status === 'loading' && (
            <Loader2 size={32} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
          )}

          {(status === 'waiting' || status === 'scanned') && qrDataUrl && (
            <>
              <img src={qrDataUrl} alt="QR Code" style={{ width: 200, height: 200 }} />
              {status === 'scanned' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255,255,255,0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Smartphone size={32} style={{ color: 'var(--color-primary)' }} />
                  <span className="text-body" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    扫码成功
                  </span>
                  <span className="text-caption" style={{ color: 'var(--color-muted)' }}>
                    请在手机上确认登录
                  </span>
                </div>
              )}
            </>
          )}

          {status === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <CheckCircle2 size={40} style={{ color: '#52c41a' }} />
              <span className="text-body" style={{ color: '#52c41a', fontWeight: 600 }}>
                登录成功
              </span>
            </div>
          )}

          {(status === 'expired' || status === 'error') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
              {status === 'expired' ? (
                <>
                  <AlertCircle size={40} style={{ color: 'var(--color-muted)' }} />
                  <span className="text-body" style={{ color: 'var(--color-muted)' }}>
                    二维码已过期
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={40} style={{ color: 'var(--color-destructive)' }} />
                  <span className="text-caption" style={{ color: 'var(--color-destructive)', textAlign: 'center' }}>
                    {errorMsg || '生成二维码失败'}
                  </span>
                </>
              )}
              <button
                onClick={generate}
                style={{
                  marginTop: 4,
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <RefreshCw size={14} />
                刷新二维码
              </button>
            </div>
          )}
        </div>

        {status === 'waiting' && (
          <div style={{ textAlign: 'center' }}>
            <p className="text-body" style={{ color: 'var(--color-foreground)' }}>
              请使用 BiliBili App 扫码登录
            </p>
            <p className="text-caption" style={{ color: 'var(--color-muted)', marginTop: 4 }}>
              二维码有效期 {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-muted)' }}>
          <span className="text-caption">打开 BiliBili App → 我的 → 扫一扫</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
