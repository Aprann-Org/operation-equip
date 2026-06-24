'use client'

import { useEffect, useState } from 'react'
import styles from './SplashScreen.module.css'

export default function SplashScreen() {
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>('in')

  useEffect(() => {
    if (sessionStorage.getItem('splash-shown')) {
      setPhase('done')
      return
    }
    sessionStorage.setItem('splash-shown', '1')
    const t1 = setTimeout(() => setPhase('out'), 2100)
    const t2 = setTimeout(() => setPhase('done'), 2850)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div className={`${styles.splash} ${phase === 'out' ? styles.exit : ''}`} aria-hidden="true">
      <div className={styles.inner}>
        <div className={styles.logoWrap}>
          <div className={styles.logoMark}>
            <div className={styles.charge} />
            <span className={styles.logoText}>OE</span>
          </div>
        </div>

        <div className={styles.copy}>
          <p className={styles.name}>Operation Equip</p>
          <p className={styles.locale}>Aprann&nbsp;·&nbsp;Haiti</p>
        </div>

        <div className={styles.track}>
          <span className={styles.trackFill} />
        </div>
      </div>
    </div>
  )
}
