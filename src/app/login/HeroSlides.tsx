'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import styles from './page.module.css'

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
  { id: 'APR-052', top: '28%', stage: 'Ready',   stageColor: '#c8913a', stageBg: 'rgba(200,145,58,0.14)' },
  { id: 'APR-039', top: '50%', stage: 'Ready',   stageColor: '#c8913a', stageBg: 'rgba(200,145,58,0.14)' },
  { id: 'APR-047', top: '72%', stage: 'Process', stageColor: '#4b9fcf', stageBg: 'rgba(75,159,207,0.14)' },
]

const LIFECYCLE = [
  { label: 'Acquired',               color: '#6b8b7e' },
  { label: 'Received',               color: '#4b9fcf' },
  { label: 'In Process',             color: '#c8913a' },
  { label: 'Ready for Distribution', color: '#9b59b6' },
  { label: 'Distributed',            color: '#15a87e' },
  { label: 'In Support',             color: '#e67e22' },
  { label: 'Retired',                color: '#4d6b5e' },
]

const DIST_NODES = [
  { label: 'Donor Organizations', sub: 'Schools · nonprofits · companies', icon: '📦', accent: false },
  { label: 'Operation Equip',     sub: 'Intake · process · track · ship',  icon: '⚙️', accent: true  },
  { label: 'Recipient Orgs',      sub: 'Schools · clinics across Haiti',   icon: '🌍', accent: false },
]

type CheckState = 'pass' | 'warn' | 'pending'

const CHECK_ICON: Record<CheckState, string> = { pass: '✓', warn: '!', pending: '–' }

const CHECKLIST: { label: string; state: CheckState; note?: string }[] = [
  { label: 'Power on successful',       state: 'pass' },
  { label: 'Display — no dead pixels',  state: 'pass' },
  { label: 'Battery capacity ≥ 80%',    state: 'pass' },
  { label: 'RAM: 4 GB installed',       state: 'warn',    note: 'target 8 GB' },
  { label: 'Storage: 64 GB free',       state: 'pass' },
  { label: 'Previous data wiped',       state: 'pass' },
  { label: 'OS current + patched',      state: 'pass' },
  { label: 'Keyboard input',            state: 'warn',    note: '2 sticky keys' },
  { label: 'WiFi connectivity',         state: 'pass' },
  { label: 'USB-A × 3 functional',      state: 'pass' },
  { label: 'Camera + microphone',       state: 'pass' },
  { label: 'HDMI output',               state: 'pending' },
  { label: 'Ethernet port',             state: 'pass' },
  { label: 'Charger included',          state: 'warn',    note: 'generic cable' },
  { label: 'Educational software',      state: 'pending' },
  { label: 'Final sign-off',            state: 'pending' },
]

const QA_IDX = 2

const SLIDES = [
  {
    key: 'pipeline' as const,
    breadcrumb: 'Device lifecycle · Aprann · Haiti · Process · Ready',
    title: ['Every device.', 'Every stage.'],
    desc: 'From donation intake to delivery — tracked, tested, and distributed to the people who need it most.',
    duration: 5000,
  },
  {
    key: 'stages' as const,
    breadcrumb: 'Acquired → In Process → Distributed → Retired',
    title: ['Seven stages.', 'Full visibility.'],
    desc: 'Every device moves through a defined lifecycle — no step skipped, nothing left untracked.',
    duration: 6000,
  },
  {
    key: 'qa' as const,
    breadcrumb: 'Device QA · APR-052 · Laptop · In Process',
    title: ['Every device', 'QA-verified.'],
    desc: 'Each device passes a 16-point inspection before it ships — hardware, software, and sign-off.',
    duration: 7000,
  },
  {
    key: 'distribution' as const,
    breadcrumb: 'Donors · Operation Equip · Recipients · Haiti',
    title: ['From donors', 'to communities.'],
    desc: 'Bridging organizations that give with schools, clinics, and nonprofits across Haiti.',
    duration: 5000,
  },
]

const trackDots = [0, 1, 2].map((t) => DOTS.filter(([track]) => track === t))

export default function HeroSlides() {
  const [active, setActive] = useState(0)
  const [qaReveal, setQaReveal] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setActive((prev) => (prev + 1) % SLIDES.length)
    }, SLIDES[active].duration)
    if (active === QA_IDX) setQaReveal((k) => k + 1)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [active])

  const slide = SLIDES[active]

  return (
    <>
      <div className={styles.heroNav}>
        <div className={styles.navBrand}>
          <span className={styles.heroLogoMark}>OE</span>
          <span className={styles.navBrandName}>Operation Equip</span>
        </div>
        <span key={active} className={styles.breadcrumb}>{slide.breadcrumb}</span>
      </div>

      <div className={styles.slidesContainer}>
        {SLIDES.map((s, i) => (
          <div
            key={s.key}
            className={`${styles.slide}${i === active ? ` ${styles.slideActive}` : ''}`}
          >
            {s.key === 'pipeline' && (
              <div className={styles.pipelineArea}>
                <div className={styles.tracks}>
                  {trackDots.map((dots, trackIdx) => (
                    <div key={trackIdx} className={styles.track}>
                      {dots.map(([, top, color, delay], dotIdx) => (
                        <span
                          key={dotIdx}
                          className={styles.dot}
                          style={{ top, background: color, animationDelay: delay }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
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
            )}

            {s.key === 'stages' && (
              <div className={styles.stagesList}>
                {LIFECYCLE.map((st) => (
                  <div key={st.label} className={styles.stageRow}>
                    <span className={styles.stageDot} style={{ background: st.color }} />
                    <span className={styles.stageLabel}>{st.label}</span>
                  </div>
                ))}
              </div>
            )}

            {s.key === 'qa' && (
              <div key={qaReveal} className={styles.qaList}>
                {CHECKLIST.map((item, idx) => (
                  <div
                    key={item.label}
                    className={styles.checkItem}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <span className={`${styles.checkStatus} ${styles[`checkStatus_${item.state}`]}`}>
                      {CHECK_ICON[item.state]}
                    </span>
                    <span className={`${styles.checkLabel}${item.state === 'pending' ? ` ${styles.checkLabelPending}` : ''}`}>
                      {item.label}
                    </span>
                    {item.note && <span className={styles.checkNote}>{item.note}</span>}
                  </div>
                ))}
              </div>
            )}

            {s.key === 'distribution' && (
              <div className={styles.distFlow}>
                {DIST_NODES.map((node, idx) => (
                  <Fragment key={node.label}>
                    <div className={`${styles.distNode}${node.accent ? ` ${styles.distNodeAccent}` : ''}`}>
                      <span className={styles.distIcon}>{node.icon}</span>
                      <div className={styles.distNodeContent}>
                        <span className={styles.distNodeLabel}>{node.label}</span>
                        <span className={styles.distNodeSub}>{node.sub}</span>
                      </div>
                    </div>
                    {idx < DIST_NODES.length - 1 && (
                      <div className={styles.distArrow}>↓</div>
                    )}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div key={active} className={styles.heroContent}>
        <p className={styles.heroTitle}>
          {slide.title[0]}<br />{slide.title[1]}
        </p>
        <p className={styles.heroDesc}>{slide.desc}</p>
      </div>

      <div className={styles.slideIndicators}>
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            className={`${styles.slideIndicator}${i === active ? ` ${styles.slideIndicatorActive}` : ''}`}
            onClick={() => setActive(i)}
            tabIndex={-1}
            aria-hidden="true"
          />
        ))}
      </div>
    </>
  )
}
