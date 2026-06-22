import { signIn } from '@/app/actions'
import styles from './page.module.css'

export const metadata = { title: 'Sign In — Operation Equip' }

// [track 0-2, top %, bg color, animation delay s]
const DOTS: [number, string, string, string][] = [
  [0, '11%', '#4d6b5e', '0s'],
  [0, '34%', '#4d6b5e', '0.9s'],
  [0, '58%', '#4b9fcf', '1.8s'],
  [0, '80%', '#4d6b5e', '2.7s'],
  [1, '19%', '#4d6b5e', '0.4s'],
  [1, '44%', '#4d6b5e', '1.3s'],
  [1, '68%', '#c8913a', '2.2s'],
  [2, '28%', '#c8913a', '0.6s'],
  [2, '50%', '#c8913a', '1.5s'],
  [2, '72%', '#4b9fcf', '2.4s'],
  [2, '88%', '#4d6b5e', '0.2s'],
]

const CARDS = [
  {
    id: 'APR-052',
    top: '28%',
    stage: 'Ready',
    stageColor: '#c8913a',
    stageBg: 'rgba(200,145,58,0.14)',
  },
  {
    id: 'APR-039',
    top: '50%',
    stage: 'Ready',
    stageColor: '#c8913a',
    stageBg: 'rgba(200,145,58,0.14)',
  },
  {
    id: 'APR-047',
    top: '72%',
    stage: 'Process',
    stageColor: '#4b9fcf',
    stageBg: 'rgba(75,159,207,0.14)',
  },
]

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  // Group dots by track for rendering
  const trackDots = [0, 1, 2].map((t) =>
    DOTS.filter(([track]) => track === t)
  )

  return (
    <div className={styles.page}>
      {/* ── Left: hero panel ─────────────────────────────── */}
      <div className={styles.hero} aria-hidden="true">
        <div className={styles.heroNav}>
          <div className={styles.navBrand}>
            <span className={styles.heroLogoMark}>OE</span>
            <span className={styles.navBrandName}>Operation Equip</span>
          </div>
          <span className={styles.breadcrumb}>
            Device lifecycle&nbsp;·&nbsp;Aprann&nbsp;·&nbsp;Haiti&nbsp;·&nbsp;process&nbsp;·&nbsp;Ready
          </span>
        </div>

        <div className={styles.pipelineArea}>
          {/* Vertical tracks */}
          <div className={styles.tracks}>
            {trackDots.map((dots, trackIdx) => (
              <div key={trackIdx} className={styles.track}>
                {dots.map(([, top, color, delay]) => (
                  <span
                    key={`${top}`}
                    className={styles.dot}
                    style={{ top, background: color, animationDelay: delay }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Device cards */}
          <div className={styles.cardsColumn}>
            {CARDS.map((card) => (
              <div key={card.id} className={styles.deviceCard} style={{ top: card.top }}>
                <span className={styles.deviceId}>{card.id}</span>
                <span
                  className={styles.cardStage}
                  style={{ color: card.stageColor, background: card.stageBg }}
                >
                  {card.stage}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Every device.<br />Every stage.
          </h1>
          <p className={styles.heroDesc}>
            From donation intake to delivery — tracked, tested, and distributed
            to the people who need it most.
          </p>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.statDot} style={{ background: '#15a87e' }} />
              162 devices
            </span>
            <span className={styles.stat}>
              <span className={styles.statDot} style={{ background: '#c8913a' }} />
              118 distributed
            </span>
          </div>
        </div>

        <div className={styles.scrollHint}>↓</div>
      </div>

      {/* ── Right: login panel ───────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.formWrap}>
          <div className={styles.brand}>
            <span className={styles.logoMark}>OE</span>
            <div className={styles.brandText}>
              <span className={styles.brandName}>Operation Equip</span>
              <span className={styles.brandSub}>Aprann · Haiti</span>
            </div>
          </div>

          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to your account to continue.</p>

          {message && (
            <p style={{
              fontSize: 13, color: 'var(--green)',
              background: 'var(--green-light)',
              padding: '9px 12px', borderRadius: 6, marginBottom: 12,
            }}>
              {decodeURIComponent(message)}
            </p>
          )}
          {error && <p className="form-error">{decodeURIComponent(error)}</p>}

          <form action={signIn}>
            <div className="field">
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@aprann.org"
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className={styles.submitBtn}>
              Sign in
            </button>
            <a href="/forgot-password" className={styles.forgotLink}>
              Forgot password?
            </a>
          </form>
        </div>
      </div>
    </div>
  )
}
