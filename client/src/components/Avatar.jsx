const AVATAR_COLORS = [
  '#00B894', '#FF6B6B', '#0984E3', '#FDCB6E', '#6C5CE7',
  '#E17055', '#00CEC9', '#A29BFE', '#FD79A8', '#55EFC4',
  '#FAB1A0', '#81ECEC', '#74B9FF', '#DFE6E9', '#F8A5C2'
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('')
}

const SIZE_MAP = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 80
}

const FONT_MAP = {
  sm: '0.75rem',
  md: '1rem',
  lg: '1.3rem',
  xl: '1.6rem'
}

export default function Avatar({ name, size = 'md', showName = false, className = '' }) {
  const px = SIZE_MAP[size] || SIZE_MAP.md
  const bg = getAvatarColor(name)

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
      <div
        className={className}
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          backgroundColor: bg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: FONT_MAP[size] || FONT_MAP.md,
          fontFamily: "'Nunito', sans-serif",
          flexShrink: 0,
          lineHeight: 1,
          textTransform: 'uppercase',
          userSelect: 'none'
        }}
        title={name}
      >
        {getInitials(name)}
      </div>
      {showName && (
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          {name}
        </span>
      )}
    </div>
  )
}
