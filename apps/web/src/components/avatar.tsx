import { API_ORIGIN } from '@/lib/api'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

interface AvatarUser {
  fullName?: string | null
  email: string
  avatar?: { storageKey: string; provider: string } | null
}

function initials(name?: string | null, email?: string) {
  const source = (name && name.trim()) || email || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function avatarSrc(avatar?: { storageKey: string; provider: string } | null) {
  if (!avatar) return null
  if (avatar.provider === 'cloudinary' && CLOUD_NAME) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,g_auto,w_256,h_256,f_auto,q_auto/${avatar.storageKey}`
  }
  if (avatar.provider === 'local') return `${API_ORIGIN}/uploads/${avatar.storageKey}`
  return null
}

export function Avatar({ user, size = 40 }: { user: AvatarUser; size?: number }) {
  const src = avatarSrc(user.avatar)
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent/15 font-semibold text-accent"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(user.fullName, user.email)
      )}
    </span>
  )
}
