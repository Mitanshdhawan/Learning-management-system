'use client'

import { motion } from 'framer-motion'
import { useEffect } from 'react'

const DURATION = 1.3 // seconds

interface Props {
  to: 'light' | 'dark'
  onMidpoint: () => void
  onDone: () => void
}

export function ThemeTransition({ to, onMidpoint, onDone }: Props) {
  useEffect(() => {
    const mid = window.setTimeout(onMidpoint, (DURATION * 1000) / 2)
    const end = window.setTimeout(onDone, DURATION * 1000)
    return () => {
      window.clearTimeout(mid)
      window.clearTimeout(end)
    }
  }, [onMidpoint, onDone])

  const isDark = to === 'dark'
  const tint = isDark ? '#080b14' : '#ffffff'
  const glow = isDark
    ? 'radial-gradient(circle, rgba(129,140,248,0.30) 0%, rgba(30,27,75,0.12) 32%, rgba(8,11,20,0) 60%)'
    : 'radial-gradient(circle, rgba(253,184,19,0.45) 0%, rgba(255,236,170,0.22) 32%, rgba(255,255,255,0) 60%)'

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {/* soft wash of the incoming theme */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: tint }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: DURATION, times: [0, 0.5, 1], ease: 'easeInOut' }}
      />

      {/* the sun / moon arcing across the sky */}
      <motion.div
        className="absolute left-0 top-0"
        initial={{ x: '-18vw', y: '92vh', rotate: -35 }}
        animate={{ x: ['-18vw', '50vw', '118vw'], y: ['92vh', '6vh', '92vh'], rotate: [-35, 0, 35] }}
        transition={{ duration: DURATION, ease: 'easeInOut', times: [0, 0.5, 1] }}
      >
        <div className="-translate-x-1/2 -translate-y-1/2">
          <div
            className="absolute left-1/2 top-1/2 h-[75vmax] w-[75vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: glow }}
          />
          <div className="relative drop-shadow-2xl">{isDark ? <MoonBig /> : <SunBig />}</div>
        </div>
      </motion.div>
    </div>
  )
}

function SunBig() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180
    return {
      x1: 60 + Math.cos(a) * 34,
      y1: 60 + Math.sin(a) * 34,
      x2: 60 + Math.cos(a) * 52,
      y2: 60 + Math.sin(a) * 52,
    }
  })
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="24" fill="#FDB813" />
      {rays.map((r, i) => (
        <line
          key={i}
          x1={r.x1}
          y1={r.y1}
          x2={r.x2}
          y2={r.y2}
          stroke="#FDB813"
          strokeWidth="5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

function MoonBig() {
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" fill="none" aria-hidden="true">
      <defs>
        <mask id="toplms-crescent">
          <rect width="110" height="110" fill="white" />
          <circle cx="74" cy="42" r="40" fill="black" />
        </mask>
      </defs>
      <circle cx="55" cy="55" r="42" fill="#E8ECF6" mask="url(#toplms-crescent)" />
    </svg>
  )
}
